import { Injectable }    from '@angular/core';
import * as MediumEditor from '../MediumEditor/js/medium-editor';

const SpectrumColorpicker = require('../SpectrumColorpicker/spectrum.js');

declare let jQuery: any;

@Injectable()
export class ColorPickerExtension {

  pickerExtension: any;
  currentTextSelection: any;
  currentColor = "#232436";

  constructor() {
    let self = this;
    // noinspection TypeScriptUnresolvedVariable
    /**
     * Custom `color picker` extension
     */
    let colorPickerExtension = MediumEditor.extensions.button.extend(
    {
      name: 'colorPicker',
      action: 'applyForeColor',
      aria: 'color picker',
      contentDefault: '<span>Text Color<span>',

      init: function ()
      {
        this.button = this.document.createElement('button');
        this.button.classList.add('medium-editor-action');
        this.button.innerHTML = '<div class="medium-color-chooser">'
            + '<div class="chooser" style=" background-color: '+self.getCurrentTextColor()+';"></div>'
            + '<i class="fa fa-chevron-down headingArrow"></i></div>';

        self.initPicker(this.button);
        this.on(this.button, 'click', this.handleClick.bind(this));
        this.subscribe('showToolbar', this.handleShowToolbar.bind(this));
      },
      handleClick: function (event)
      {
        self.currentTextSelection = this.base.exportSelection();

        jQuery(this.button).spectrum('set', self.getCurrentTextColor());

        event.preventDefault();
        event.stopPropagation();

        let action = this.getAction();

        if (action) {
          this.execAction(action);
        }
      },
      handleShowToolbar: function(event)
      {
        let node;
        if (window.getSelection) {
          node = window.getSelection();
        } else {
          self.setChooserColor('#2A2B3B');
          return;
        }

        let color = getComputedStyle(<HTMLElement> node.anchorNode.parentNode, null).color;
        self.setCurrentTextColor(color);
        self.setChooserColor(color);
      }
    });

    this.pickerExtension = new colorPickerExtension();
  }

  setColor(color) {
    let finalColor = color ? color.toRgbString() : 'rgba(42,43,59,0)';
    this.setChooserColor(finalColor);
    this.pickerExtension.base.importSelection(this.currentTextSelection);
    this.pickerExtension.document.execCommand('styleWithCSS', false, true);
    this.pickerExtension.document.execCommand('foreColor', false, finalColor);
  }

  initPicker(element) {
    let self = this;

    jQuery(element).spectrum({
        showPaletteOnly: true,
        showPalette: true,
        change: function(color) {
          self.setColor(color);
        },
        hide: function(color) {
          self.setColor(color);
        },
        palette: [
          ['#2A2B3B', '#8E8E8E', '#727272', '#232436'],
          ['#5FA1F0', '#819AC8', '#444353', '#C0B9A9'],
          ['#62A476', '#B24846', '#B9AA3F', '#8A884A']
        ]
    });
  }

  setChooserColor(color) {
      let chooser = <HTMLElement> document.querySelector('.medium-color-chooser .chooser');
      if (chooser) {
        chooser.style.backgroundColor = color;
      }
  }

  setCurrentTextColor(color) {
    this.currentColor = color;
  }

  getCurrentTextColor() {
    return this.currentColor;
  }

  getPickerExtension() {
    return this.pickerExtension;
  }
}
