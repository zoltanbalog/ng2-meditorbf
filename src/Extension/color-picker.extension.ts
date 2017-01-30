import { Injectable }    from '@angular/core';
import * as MediumEditor from '../MediumEditor/js/medium-editor';

@Injectable()
export class ColorPickerExtension {

  pickerExtension: any;
  currentTextSelection: any;
  currentColor = "#50515E";

  constructor() {
    let self = this;

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
            let pickerHtml = `
                    <div class="sp-container">
                        <div class="sp-palette-container">
                            <div class="sp-palette sp-thumb sp-cf">
                                <div class="sp-cf sp-palette-row sp-palette-row-0">
                                    <span title="rgb(80, 81, 94)" class="sp-thumb-el sp-thumb-dark sp-thumb-active">
                                        <span class="sp-thumb-inner" data-color="rgb(80, 81, 94)" style="background-color:rgb(80, 81, 94);"></span>
                                    </span>
                                    <span title="rgb(142, 142, 142)" class="sp-thumb-el sp-thumb-light">
                                        <span class="sp-thumb-inner" data-color="rgb(142, 142, 142)" style="background-color:rgb(142, 142, 142);"></span>
                                    </span>
                                    <span title="rgb(114, 114, 114)" class="sp-thumb-el sp-thumb-dark">
                                        <span class="sp-thumb-inner" data-color="rgb(114, 114, 114)" style="background-color:rgb(114, 114, 114);"></span>
                                    </span>
                                    <span title="rgb(35, 36, 54)" class="sp-thumb-el sp-thumb-dark">
                                        <span class="sp-thumb-inner" data-color="rgb(35, 36, 54)" style="background-color:rgb(35, 36, 54);"></span>
                                    </span>
                                </div>
                                <div class="sp-cf sp-palette-row sp-palette-row-1">
                                      <span title="rgb(95, 161, 240)" class="sp-thumb-el sp-thumb-light">
                                          <span class="sp-thumb-inner" data-color="rgb(95, 161, 240)" style="background-color:rgb(95, 161, 240);"></span>
                                      </span>
                                      <span title="rgb(129, 154, 200)" class="sp-thumb-el sp-thumb-light">
                                          <span class="sp-thumb-inner" data-color="rgb(129, 154, 200)" style="background-color:rgb(129, 154, 200);"></span>
                                      </span>
                                      <span title="rgb(68, 67, 83)" class="sp-thumb-el sp-thumb-dark">
                                          <span class="sp-thumb-inner" data-color="rgb(68, 67, 83)" style="background-color:rgb(68, 67, 83);"></span>
                                      </span>
                                      <span title="rgb(192, 185, 169)" class="sp-thumb-el sp-thumb-light">
                                          <span class="sp-thumb-inner" data-color="rgb(192, 185, 169)" style="background-color:rgb(192, 185, 169);"></span>
                                      </span>
                                </div>
                                <div class="sp-cf sp-palette-row sp-palette-row-2">
                                    <span title="rgb(98, 164, 118)" class="sp-thumb-el sp-thumb-light">
                                        <span class="sp-thumb-inner" data-color="rgb(98, 164, 118)" style="background-color:rgb(98, 164, 118);"></span>
                                    </span>
                                    <span title="rgb(178, 72, 70)" class="sp-thumb-el sp-thumb-dark">
                                        <span class="sp-thumb-inner" data-color="rgb(178, 72, 70)" style="background-color:rgb(178, 72, 70);"></span>
                                    </span>
                                    <span title="rgb(185, 170, 63)" class="sp-thumb-el sp-thumb-dark">
                                        <span class="sp-thumb-inner" data-color="rgb(185, 170, 63)" style="background-color:rgb(185, 170, 63);"></span>
                                    </span>
                                    <span title="rgb(138, 136, 74)" class="sp-thumb-el sp-thumb-dark">
                                        <span class="sp-thumb-inner" data-color="rgb(138, 136, 74)" style="background-color:rgb(138, 136, 74);"></span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            let buttonHtml = `
                    <button type="button"  id="headingDropdown">
                        <span class="dropdown-button">
                            <div class="chooser" style=" background-color: `+self.getCurrentTextColor()+`;"></div>
                            <i class="fa fa-chevron-down headingArrow"></i>
                        </span>
                    </button>
                    <ul class="dropdown-menu">
                        `+ pickerHtml +`
                    </ul>
                `;

            this.button = this.document.createElement('div');
            this.button.classList.add('dropdown');
            this.button.classList.add('medium-editor-action');
            this.button.classList.add('medium-editor-dropdown-container');
            this.button.classList.add('medium-color-chooser');
            this.button.innerHTML = buttonHtml;

            this.on(this.button, 'click', this.handleClick.bind(this));
            this.subscribe('showToolbar', this.handleShowToolbar.bind(this));
          },
          handleClick: function (event) {
            self.currentTextSelection = this.base.exportSelection();
            let target = event.target;

            event.preventDefault();
            event.stopPropagation();

            if (target && target.classList && target.classList.contains('sp-thumb-inner')
                && target.getAttribute && target.getAttribute('data-color')
            ) {
              self.setColor(target.getAttribute('data-color'));
              self.changeActivePaletElement(target);
            }

            self.toggleDropdownMenu(target);
          },
          handleShowToolbar: function(event) {
            let node;
            if (window.getSelection) {
              node = window.getSelection();
            } else {
              self.setChooserColor(self.getCurrentTextColor());
              return;
            }

            let element = <HTMLElement> node.anchorNode.parentNode;
            let color = getComputedStyle(element, null).color;
            self.setCurrentTextColor(color);
            self.setChooserColor(color);
            let target = document.querySelector('.sp-thumb-inner[data-color="' + color + '"]');
            if (target) {
              self.changeActivePaletElement(target);
            }
          }
        });

    this.pickerExtension = new colorPickerExtension();
  }

  changeActivePaletElement(target) {
    let activeElement = document.querySelector('.sp-thumb-active');
    if (activeElement && activeElement.classList) {
      activeElement.classList.remove('sp-thumb-active');
    }
    target.parentNode.classList.add('sp-thumb-active');
  }

  setColor(color) {
    let finalColor = color ? color : 'rgba(80, 81, 94)';
    this.setChooserColor(finalColor);
    this.pickerExtension.base.importSelection(this.currentTextSelection);
    this.pickerExtension.document.execCommand('styleWithCSS', false, true);
    this.pickerExtension.document.execCommand('foreColor', false, finalColor);
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

  getClosestElementByClass(element, className) {
    while (element.parentNode) {
      let parent = element.parentNode;
      if (element && element.classList && element.classList.contains('dropdown')) {
        return element;
      }
      element = parent;
    }
    return false;
  }

  toggleDropdownMenu(targetElement) {
    let dropdownElement = this.getClosestElementByClass(targetElement, 'dropdown');
    if (dropdownElement && dropdownElement.classList.contains('open')) {
      dropdownElement.classList.remove('open');
    } else if (dropdownElement) {
      dropdownElement.classList.add('open');
    }
  }

  getPickerExtension() {
    return this.pickerExtension;
  }
}
