import { Injectable }    from '@angular/core';

import * as MediumEditor from '../MediumEditor/js/medium-editor';

@Injectable()
export class CleanFormatExtension {

    cleanFormatExtension: any;
    startElement: any = null;
    endElement: any = null;
    cleanAttrs: any;// = ['style', 'dir', 'class', 'width', 'height'];

    constructor() {
        let self = this;

        let customHeadingExtension = MediumEditor.extensions.button.extend({
            name: 'cleanFormatExtension',
            action: 'applyForHeading',
            aria: 'Clean',
            contentDefault: '<span>Clean<span>',

            init: function ()
            {
                this.button = this.document.createElement('button');
                this.button.classList.add('medium-editor-action');
                this.button.innerHTML = '<i class="fa fa-eraser"></i>';

                this.on(this.button, 'click', this.handleClick.bind(this));
                this.subscribe('showToolbar', this.handleShowToolbar.bind(this));
            },
            handleClick: function (event)
            {
                if (self.startElement == null || self.endElement == null) {
                    return;
                }

                if (self.startElement == self.endElement) {
                    let allElements = self.startElement.querySelectorAll('*');
                    for (let i = 0; i < allElements.length; i += 1) {
                        let workEl = allElements[i];
                        self.cleanupAttrs(workEl);
                    }
                    self.cleanupAttrs(self.startElement);
                } else {
                    let actualNode = self.startElement;
                    while (actualNode && actualNode != self.endElement) {
                        if (actualNode.nodeType != 1) {
                            actualNode = actualNode.nextSibling;
                            continue;
                        }

                        let allElements = actualNode.querySelectorAll('*');
                        for (let i = 0; i < allElements.length; i += 1) {
                            let workEl = allElements[i];
                            self.cleanupAttrs(workEl);
                        }
                        self.cleanupAttrs(actualNode);

                        actualNode = actualNode.nextSibling;
                    }
                    self.cleanupAttrs(self.endElement);
                }

                self.startElement = null;
                self.endElement = null;
            },
            handleShowToolbar: function(event)
            {
                if (!MediumEditor.selection || !MediumEditor.selection.getSelectionRange(this.document)) {
                    return;
                }

                let range = MediumEditor.selection.getSelectionRange(this.document);
                self.startElement = range.startContainer.parentNode;
                self.endElement = range.endContainer.parentNode;
            }
        });

        this.cleanFormatExtension = new customHeadingExtension();
    }

    getCleanFormatExtension() {
        return this.cleanFormatExtension;
    }

    setCleanupAttrs(cleanupAttrs) {
        this.cleanAttrs = cleanupAttrs;
    }

    cleanupAttrs(element) {
        if (element.nodeType != 1
            || this.closestElementByClass(element, 'pinnable-image-row')
            || this.elementHasClass(element, 'pinnable-image-row')
        ) {
            return;
        }
        this.cleanAttrs.forEach(function (attr) {
            element.removeAttribute(attr);
        });
    }

    elementHasClass(element, className) {
        if (element && element.classList && element.classList.contains(className)) {
            return true;
        }
        return false;
    }

    closestElementByClass(element, selector) {
        while (element.parentNode) {
            let parent = element.parentNode;
            if (this.elementHasClass(parent, selector)) {
                return parent;
            }
            element = parent;
        }
        return false;
    }

  }
