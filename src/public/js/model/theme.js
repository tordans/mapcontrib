
import _ from 'underscore';
import Backbone from 'backbone';
import BackboneRelational from 'backbone-relational';
import settings from '../settings';
import Diacritics from 'diacritic';

import LayerCollection from '../collection/layer';
import PresetCollection from '../collection/preset';
import Layer from './layer';
import Preset from './preset';


export default Backbone.RelationalModel.extend({
    idAttribute: '_id',

    urlRoot: settings.apiPath + 'theme',

    relations: [
        {
            type: Backbone.HasMany,
            key: 'layers',
            relatedModel: Layer,
            collectionType: LayerCollection,
        },
        {
            type: Backbone.HasMany,
            key: 'presets',
            relatedModel: Preset,
            collectionType: PresetCollection,
        },
    ],

    defaults: {
        'userId': undefined,
        'name': 'MapContrib',
        'description': '',
        'color': 'blue',
        'tiles': ['osmFr'],
        'zoomLevel': 3,
        'center': {
            'lat': 33.57,
            'lng': 1.58,
        },
        'owners': [],
    },

    /**
     * Check if a user is owner of this theme.
     *
     * @author Guillaume AMAT
     * @access public
     * @param {object} userModel - A user model
     * @return boolean
     */
    isOwner: function (userModel) {
        let userId = userModel.get('_id');

        if ( !userId ) {
            return false;
        }

        if ( this.get('userId') === userId ) {
            return true;
        }

        if ( this.get('owners').indexOf( userId ) > -1 ) {
            return true;
        }

        if ( this.get('owners').indexOf('*') > -1 ) {
            return true;
        }

        return false;
    },

    /**
     * Returns a URL-friendly name of the theme.
     *
     * @author Guillaume AMAT
     * @access public
     * @return string
     */
    buildWebLinkName: function () {
        let name = this.get('name') || '';

        name = Diacritics.clean(name);
        name = name.replace(/-/g, '_');
        name = name.replace(/ /g, '_');
        name = name.replace(/_{2,}/g, '_');
        name = name.replace(/[^a-zA-Z0-9\_]/g, '');

        return name;
    },

    /**
     * Returns the theme path.
     *
     * @author Guillaume AMAT
     * @access public
     * @return string
     */
    buildPath: function () {
        return '/t/' +
        this.get('fragment') +
        '-' +
        this.buildWebLinkName();
    }
});
