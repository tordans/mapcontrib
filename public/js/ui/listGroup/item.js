
import Marionette from 'backbone.marionette';
import template from './item.ejs';


export default Marionette.ItemView.extend({
    template: template,

    tagName: 'a',

    className: 'list-group-item',

    attributes: {
        'href': '#',
    },

    modelEvents: {
        'change': 'render'
    },

    ui: {
        'reorderIcon': '.reorder_icon',
        'removeBtn': '.remove_btn',
    },

    events: {
        'click': 'onClick',
        'click @ui.removeBtn': 'onClickRemove',
    },

    templateHelpers() {
        return {
            'icon': this.options.getIcon(this.model),
        };
    },

    onRender() {
        if ( !this.options.reorderable ) {
            this.ui.reorderIcon.hide();
        }

        if ( !this.options.removeable ) {
            this.ui.removeBtn.hide();
        }

        this.el.id = 'item-'+ this.model.cid;
    },

    onClick(e) {
        e.stopPropagation();
        e.preventDefault();

        this.trigger('select', this.model);
    },

    onClickRemove(e) {
        e.stopPropagation();

        this.model.destroy();
    },
});
