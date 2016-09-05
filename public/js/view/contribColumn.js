
import Wreqr from 'backbone.wreqr';
import Marionette from 'backbone.marionette';
import NavPillsStackedListView from '../ui/navPillsStacked';
import SearchInput from '../ui/form/searchInput';
import template from '../../templates/contribColumn.ejs';


export default Marionette.LayoutView.extend({
    template: template,

    behaviors: {
        'l20n': {},
        'column': {},
    },

    regions: {
        'searchInput': '.rg_search_input',
        'presetsNav': '.rg_presets_nav',
        'freeAdditionNav': '.rg_free_addition_nav',
    },

    ui: {
        'column': '#contrib_column',
        'noResult': '.no_result',
        'footer': '.sticky-footer',
    },

    initialize() {
        this._radio = Wreqr.radio.channel('global');
        this._presets = this.options.theme.get('presets');
        this._iDPresetsHelper = this.options.iDPresetsHelper;
    },

    onBeforeOpen() {
        this._radio.vent.trigger('column:closeAll', [ this.cid ]);
        this._radio.vent.trigger('widget:closeAll', [ this.cid ]);
    },

    open() {
        this.render();
        this.triggerMethod('open');
        return this;
    },

    close() {
        this.triggerMethod('close');
        return this;
    },

    setCenter( center ) {
        this._center = center;
    },

    _buildNavItemsFromPresetModels(presetModels) {
        return presetModels.map(presetModel => {
            return {
                'label': presetModel.get('name'),
                'description': presetModel.get('description'),
                'callback': this._radio.commands.execute.bind(
                    this._radio.commands,
                    'column:showContribForm',
                    {
                        'presetModel': presetModel,
                        'center': this._center,
                        'iDPresetsHelper': this._iDPresetsHelper,
                    }
                )
            };
        });
    },

    _buildNavItemsFromIDPresets(defaultIDPresets) {
        return defaultIDPresets.map(iDPreset => {
            return {
                'label': iDPreset.name,
                // 'callback': this._radio.commands.execute.bind(
                //     this._radio.commands,
                //     'column:showContribForm',
                //     {
                //         'presetModel': presetModels[key],
                //         'center': this._center,
                //         'iDPresetsHelper': this._iDPresetsHelper,
                //     }
                // )
            };
        });
    },

    onRender() {
        const presetModels = this._presets.models;
        const defaultIDPresets = this._iDPresetsHelper.getDefaultPoints();
        const presetNavItems = [
            ...this._buildNavItemsFromPresetModels(presetModels),
            ...this._buildNavItemsFromIDPresets(defaultIDPresets)
        ];


        this._presetsNav = new NavPillsStackedListView();
        this._presetsNav.setItems(presetNavItems);
        this.getRegion('presetsNav').show( this._presetsNav );


        this._searchInput = new SearchInput({
            charactersMin: 1,
            placeholder: document.l10n.getSync('contribColumn_searchAPreset'),
        });

        this.getRegion('searchInput').show( this._searchInput );
        this._searchInput.setFocus();
        this._searchInput.on('search', this._filterPresets, this);
        this._searchInput.on(
            'empty',
            this._presetsNav.setItems.bind(this._presetsNav, presetNavItems),
            this
        );

        if (this.options.config.freeTagsContributionEnabled) {
            const freeAdditionNav = new NavPillsStackedListView();
            freeAdditionNav.setItems([{
                'label': document.l10n.getSync('contribColumn_freeAddition'),
                'callback': this._radio.commands.execute.bind(
                    this._radio.commands,
                    'column:showContribForm',
                    {
                        'center': this._center,
                    }
                )
            }]);
            this.getRegion('freeAdditionNav').show( freeAdditionNav );
        }
        else {
            this.ui.footer.hide();
        }
    },

    _filterPresets(searchString) {
        this._searchInput.trigger('search:success');

        const iDPresets = this._iDPresetsHelper.buildPresetsFromSearchString(searchString);
        const presetModels = this._presets.buildPresetsFromSearchString(searchString);
        const presetNavItems = [
            ...this._buildNavItemsFromPresetModels(presetModels),
            ...this._buildNavItemsFromIDPresets(iDPresets)
        ];

        this._presetsNav.setItems(presetNavItems);

        if (presetNavItems.length === 0) {
            this._showNoResult();
        }
        else {
            this._hideNoResult();
        }
    },

    _hideNoResult() {
        this.ui.noResult.addClass('hide');
    },

    _showNoResult() {
        this.ui.noResult.removeClass('hide');
    },
});
