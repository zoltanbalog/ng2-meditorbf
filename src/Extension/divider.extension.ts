import { Injectable }    from '@angular/core';

import * as MediumEditor from '../MediumEditor/js/medium-editor';

@Injectable()
export class DividerExtension {

    customDividerExtension: any;

    constructor() {
        this.customDividerExtension = MediumEditor.extensions.button.extend({
            action: 'applyForDivider',
            aria: 'heading',
            contentDefault: '<span class="divider"><span>',

            init: function ()
            {
                this.button = this.document.createElement('div');
                this.button.classList.add('medium-editor-action');
                this.button.classList.add('divider');
            }
        });
    }

    getDividerExtension() {
        return new this.customDividerExtension();
    }
}
