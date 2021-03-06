import CONST from 'const';
import Wreqr from 'backbone.wreqr';

export default class MapUi {
  /**
     * Displays the contribution cross.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     */
  static showContributionCross() {
    document.body.classList.add('contribution_cross_visible');
    document
      .querySelector('.leaflet-marker-pane')
      .classList.add('in_contribution');
  }

  /**
     * Hides the contribution cross.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     */
  static hideContributionCross() {
    document.body.classList.remove('contribution_cross_visible');
    document
      .querySelector('.leaflet-marker-pane')
      .classList.remove('in_contribution');
  }

  /**
     * Returns the POI layer Leaflet icon.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel - Model of the POI layer which we request its icon.
     * @return {object} - A Leaflet divIcon.
     */
  static buildLayerIcon(layerModel) {
    return L.divIcon(MapUi.buildMarkerLayerIconOptions(layerModel));
  }

  /**
     * Returns the POI layer HTML icon.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel - Model of the POI layer which we request its icon.
     * @return {string} - The HTML tags of the icon.
     */
  static buildLayerHtmlIcon(layerModel) {
    const markerShape = layerModel.get('markerShape');
    const iconColor = layerModel.get('markerColor');
    const className = CONST.map.markers[markerShape].className;
    const iconHtml = MapUi.buildMarkerLayerIconOptions(layerModel).html;

    return `<div class="${className} ${iconColor}">${iconHtml}</div>`;
  }

  /**
     * Returns the POI layer icon options.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel - Model of the POI layer which we request its icon.
     * @return {object} - The icon options.
     */
  static buildMarkerLayerIconOptions(layerModel) {
    const markerShape = layerModel.get('markerShape');
    const markerIcon = layerModel.get('markerIcon');
    const markerIconType = layerModel.get('markerIconType');
    const markerIconUrl = layerModel.get('markerIconUrl');
    const markerColor = layerModel.get('markerColor');
    const iconOptions = { ...CONST.map.markers[markerShape] };

    iconOptions.className += ` ${markerColor}`;

    switch (markerIconType) {
      case CONST.map.markerIconType.external:
        if (markerIconUrl) {
          iconOptions.html += `<img src="${markerIconUrl}" class="external-icon">`;
        }
        break;

      default:
      case CONST.map.markerIconType.library:
        if (markerIcon) {
          iconOptions.html += `<i class="fa fa-${markerIcon} fa-fw"></i>`;
        }
    }

    return iconOptions;
  }

  /**
     * Returns the layer polyline options.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel - Model of the polyline's POI layer.
     * @return {object} - The polyline options.
     */
  static buildLayerPolylineStyle(layerModel) {
    let color = layerModel.get('markerColor');

    if (color === 'dark-gray') {
      color = 'anthracite';
    }

    return {
      ...CONST.map.wayPolylineOptions,
      ...{ color: CONST.colors[color] }
    };
  }

  /**
     * Returns the layer polygon options.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel - Model of the polygon's POI layer.
     * @return {object} - The polygon options.
     */
  static buildLayerPolygonStyle(layerModel) {
    let color = layerModel.get('markerColor');

    if (color === 'dark-gray') {
      color = 'anthracite';
    }

    return {
      ...CONST.map.wayPolygonOptions,
      ...{ color: CONST.colors[color] }
    };
  }

  /**
     * Returns a marker cluster built for a layer model.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel.
     * @return {object} - The marker cluster layer.
     */
  static buildMarkerClusterLayer(layerModel) {
    return L.markerClusterGroup({
      polygonOptions: CONST.map.markerCLusterPolygonOptions,
      animate: false,
      animateAddingMarkers: false,
      spiderfyOnMaxZoom: false,
      disableClusteringAtZoom: 18,
      zoomToBoundsOnClick: true,
      iconCreateFunction: cluster => {
        const count = cluster.getChildCount();
        const color = layerModel.get('markerColor');

        return L.divIcon({
          html: `<div class="marker-cluster ${color}">${count}</div>`
        });
      }
    });
  }

  /**
     * Returns a heat layer built for a layer model.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel.
     * @return {object} - The heat layer.
     */
  static buildHeatLayer(layerModel) {
    const heatLayer = L.heatLayer([], MapUi.buildHeatLayerOptions(layerModel));

    heatLayer.addLayer = layer => {
      if (layer.feature.geometry.type === 'Point') {
        heatLayer.addLatLng(
          L.latLng(
            layer.feature.geometry.coordinates[1],
            layer.feature.geometry.coordinates[0]
          )
        );
      }
    };

    return heatLayer;
  }

  /**
     * Returns the heat layer options.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {string} layerModel.
     * @return {object} - The heat layer.
     */
  static buildHeatLayerOptions(layerModel) {
    const options = {
      minOpacity: layerModel.get('heatMinOpacity'),
      maxZoom: layerModel.get('heatMaxZoom'),
      max: layerModel.get('heatMax'),
      blur: layerModel.get('heatBlur'),
      radius: layerModel.get('heatRadius')
    };

    return options;
  }

  /**
     * Checks if the layer's display has to be updated.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {object} layerModel.
     * @param {object} olderLayerModel.
     * @param {boolean} isNew.
     */
  static updateLayerDisplayFromOlderModel(layerModel, oldLayerModel, isNew) {
    const radio = Wreqr.radio.channel('global');

    if (isNew) {
      radio.commands.execute('map:addLayer', layerModel);
    } else {
      MapUi.updateLayerStyleFromOlderModel(layerModel, oldLayerModel);

      if (oldLayerModel.get('visible') !== layerModel.get('visible')) {
        if (layerModel.get('visible')) {
          radio.commands.execute('map:addLayer', layerModel);
        } else {
          radio.commands.execute('map:removeLayer', layerModel);
        }

        radio.commands.execute('column:selectLayer:render');
      }
    }
  }

  /**
     * Checks if the layer's display has to be updated.
     *
     * @author Guillaume AMAT
     * @static
     * @access public
     * @param {object} layerModel.
     * @param {object} olderLayerModel.
     */
  static updateLayerStyleFromOlderModel(layerModel, oldLayerModel) {
    const radio = Wreqr.radio.channel('global');
    let updateRepresentation = false;
    let updateMarkers = false;
    let updateHeat = false;
    let updatePopups = false;
    let updateMinZoom = false;

    if (
      oldLayerModel.get('rootLayerType') !== layerModel.get('rootLayerType')
    ) {
      updateRepresentation = true;
    }

    if (
      oldLayerModel.get('heatMinOpacity') !==
        layerModel.get('heatMinOpacity') ||
      oldLayerModel.get('heatMaxZoom') !== layerModel.get('heatMaxZoom') ||
      oldLayerModel.get('heatMax') !== layerModel.get('heatMax') ||
      oldLayerModel.get('heatBlur') !== layerModel.get('heatBlur') ||
      oldLayerModel.get('heatRadius') !== layerModel.get('heatRadius')
    ) {
      updateHeat = true;
    }

    if (
      oldLayerModel.get('markerIconType') !==
        layerModel.get('markerIconType') ||
      oldLayerModel.get('markerIconUrl') !== layerModel.get('markerIconUrl') ||
      oldLayerModel.get('markerColor') !== layerModel.get('markerColor') ||
      oldLayerModel.get('markerIcon') !== layerModel.get('markerIcon') ||
      oldLayerModel.get('markerShape') !== layerModel.get('markerShape')
    ) {
      updateMarkers = true;
    }

    if (oldLayerModel.get('popupContent') !== layerModel.get('popupContent')) {
      updatePopups = true;
    }

    if (oldLayerModel.get('minZoom') !== layerModel.get('minZoom')) {
      updateMinZoom = true;
    }

    if (updateRepresentation) {
      radio.commands.execute('map:updateRepresentation', layerModel);
    } else {
      if (updateMarkers) {
        radio.commands.execute('map:updateMarkerStyle', layerModel);
      }

      if (updateHeat) {
        radio.commands.execute('map:updateHeatStyle', layerModel);
      }

      if (updatePopups) {
        radio.commands.execute('map:updateLayerPopups', layerModel);
      }
    }

    if (updateMinZoom) {
      radio.commands.execute('map:updateLayerMinZoom', layerModel);
    }
  }
}
