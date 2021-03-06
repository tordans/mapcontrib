import config from 'config';
import path from 'path';
import fs from 'fs-extra';
import osmtogeojson from 'osmtogeojson';
import request from 'request';
import logger from '../lib/logger';
import SERVER_CONST from '../const';
import PUBLIC_CONST from '../public/js/const';
import OverPassHelper from '../public/js/helper/overPass';
import GeoUtils from '../public/js/core/geoUtils';
import LayerModel from '../public/js/model/layer';

const CONST = { ...SERVER_CONST, ...PUBLIC_CONST };

export default class OverPassCache {
  constructor(db) {
    this._db = db;
    this._tooManyRequestsTriesInARow = 0;
  }

  process(theme, layer, next, retry, setSuccess, setError, setDeletedFeatures) {
    logger.debug('process');

    if (layer.type !== CONST.layerType.overpass) {
      return next();
    }

    if (layer.cache === false) {
      return next();
    }

    logger.info('Next request');
    logger.info('Theme fragment:', theme.fragment);
    logger.info('Layer uuid:', layer.uuid);

    const layerModel = new LayerModel(layer);
    const bounds = GeoUtils.zoomLatLngWidthHeightToBbox(
      theme.zoomLevel,
      theme.center.lat,
      theme.center.lng,
      3840,
      2160
    );

    const url = OverPassHelper.buildUrlForCache(
      config.get('client.overPassEndPoint'),
      layerModel.get('overpassRequest'),
      config.get('client.overPassCacheFileSize'),
      bounds
    );

    OverPassCache._retrieveData(url)
      .then(data => {
        if (OverPassCache.isCacheArchiveEnabled(layerModel)) {
          const deletedFeatures = OverPassCache._findDeletedFeatures(
            theme.fragment,
            layerModel.get('uuid'),
            data
          );

          if (deletedFeatures) {
            setDeletedFeatures(theme, layer, deletedFeatures);
          }
        }

        OverPassCache._saveCacheFile(theme.fragment, layerModel.get('uuid'), data)
          .then(savedFilePath => setSuccess(theme, layer, bounds, savedFilePath))
          .then(next)
          .catch(next);
      })
      .catch(reason => {
        const { status, body } = reason;

        if (status === 429) {
          this._tooManyRequestsTriesInARow += 1;
          const maxTries = CONST.overPassCron.tooManyRequestsTriesInARow;

          logger.warn(`OverPass says: Too many requests... (${this._tooManyRequestsTriesInARow})`);

          if (this._tooManyRequestsTriesInARow < maxTries) {
            logger.info('Retrying in a few seconds');
            return retry(theme, layer);
          }

          logger.error('Impossible to finish the update of the OverPass cache');
          logger.error(
            `OverPass said « Too many requests » ${this._tooManyRequestsTriesInARow} times`
          );

          this._db.close();

          return process.exit(1);
        }

        this._tooManyRequestsTriesInARow = 0;

        if (status === 400) {
          logger.warn('OverPass says: Bad request');

          return OverPassCache._deleteCacheFile(theme.fragment, layerModel.get('uuid'))
            .then(setError(theme, layer, CONST.overPassCacheError.badRequest))
            .then(next)
            .catch(next);
        } else if (status === 524) {
          logger.warn('Request timed out');

          return OverPassCache._deleteCacheFile(theme.fragment, layerModel.get('uuid'))
            .then(setError(theme, layer, CONST.overPassCacheError.timeout))
            .then(next)
            .catch(next);
        }

        if (status !== 200) {
          logger.warn('Unknown error, next!');

          return OverPassCache._deleteCacheFile(theme.fragment, layerModel.get('uuid'))
            .then(setError(theme, layer, CONST.overPassCacheError.unknown))
            .then(next)
            .catch(next);
        }

        let error;
        const overPassJson = JSON.parse(body);

        if (overPassJson.remark.indexOf('Query timed out') > -1) {
          logger.warn('OverPass says: Timeout');
          error = CONST.overPassCacheError.timeout;
        } else if (overPassJson.remark.indexOf('Query ran out of memory') > -1) {
          logger.warn('OverPass says: Out of memory');
          error = CONST.overPassCacheError.memory;
        }

        return OverPassCache._deleteCacheFile(theme.fragment, layerModel.get('uuid'))
          .then(setError(theme, layer, error))
          .then(next)
          .catch(next);
      });

    return true;
  }

  static _retrieveData(uri) {
    logger.debug('_retrieveData');

    const timeout = parseInt(config.get('client.overPassTimeout'), 10);

    return new Promise((resolve, reject) => {
      request(
        {
          method: 'GET',
          gzip: true,
          uri,
          timeout
        },
        (error, response, body) => {
          try {
            if (error) {
              if (error.code && error.code === 'ETIMEDOUT') {
                reject({
                  status: 524,
                  body
                });
                return;
              }

              if (!response || !response.statusCode) {
                reject({
                  status: null,
                  body
                });
                return;
              }
            }

            if (response.statusCode !== 200) {
              reject({
                status: response.statusCode,
                body
              });
              return;
            }

            const overPassJson = JSON.parse(body);

            if (overPassJson.remark) {
              reject({
                status: response.statusCode,
                body
              });
              return;
            }

            resolve(overPassJson);
            return;
          } catch (e) {
            logger.error('erreur catch', e);
          }
        }
      );
    });
  }

  static _buildDirectories(themeFragment, layerUuid) {
    logger.debug('_buildDirectories');

    const publicDirectory = path.resolve(__dirname, '..', 'public');
    const publicCacheDirectory = `files/theme/${themeFragment}/overPassCache/`;
    const cacheDirectory = path.resolve(publicDirectory, publicCacheDirectory);
    const filePath = path.join(publicCacheDirectory, `${layerUuid}.geojson`);

    fs.mkdirpSync(cacheDirectory);

    return {
      publicDirectory,
      publicCacheDirectory,
      cacheDirectory,
      filePath
    };
  }

  static _saveCacheFile(themeFragment, layerUuid, overPassResult) {
    logger.debug('_saveCacheFile');

    return new Promise(resolve => {
      const overPassGeoJson = osmtogeojson(overPassResult);
      const { publicDirectory, filePath } = OverPassCache._buildDirectories(
        themeFragment,
        layerUuid
      );

      fs.writeFile(path.resolve(publicDirectory, filePath), JSON.stringify(overPassGeoJson), () => {
        resolve(`/${filePath}`);
      });
    });
  }

  static _findDeletedFeatures(themeFragment, layerUuid, overPassResult) {
    logger.debug('_findDeletedFeatures');

    const overPassGeoJson = osmtogeojson(overPassResult);
    const { publicDirectory, filePath } = OverPassCache._buildDirectories(themeFragment, layerUuid);

    let data;

    try {
      data = fs.readFileSync(path.resolve(publicDirectory, filePath));
    } catch (e) {
      return false;
    }

    if (!data) {
      return false;
    }

    const oldGeoJson = JSON.parse(data);
    return OverPassCache._extractDeletedFeatures(oldGeoJson, overPassGeoJson);
  }

  static _extractDeletedFeatures(oldGeoJson, overPassGeoJson) {
    const deletedFeatures = [];
    const newFeaturesId = overPassGeoJson.features.map(feature => feature.id);

    for (const oldFeature of oldGeoJson.features) {
      if (newFeaturesId.indexOf(oldFeature.id) === -1) {
        deletedFeatures.push(oldFeature);
      }
    }

    return deletedFeatures;
  }

  static _deleteCacheFile(themeFragment, layerUuid) {
    logger.debug('_deleteCacheFile');

    return new Promise(resolve => {
      const { publicDirectory, filePath } = OverPassCache._buildDirectories(
        themeFragment,
        layerUuid
      );

      fs.unlink(path.resolve(publicDirectory, filePath), () => {
        resolve();
      });
    });
  }

  static isCacheArchiveEnabled(layerModel) {
    if (config.get('client.overPassCacheArchiveEnabled') && layerModel.get('cacheArchive')) {
      return true;
    }

    return false;
  }
}
