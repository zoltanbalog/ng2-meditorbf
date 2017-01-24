import { Injectable }    from '@angular/core';

import * as MediumEditor from '../MediumEditor/js/medium-editor';

@Injectable()
export class HeadingExtension {

    headingExtension: any;
    defaultButtonText: string = 'Heading';

    constructor() {
        let self = this;

        let customHeadingExtension = MediumEditor.extensions.button.extend({
                name: 'headingExtension',
                action: 'applyForHeading',
                aria: 'heading',
                contentDefault: '<span>Heading<span>',

                init: function ()
                {
                    let buttonHtml =
                         '<button type="button"  id="headingDropdown">'
                            +'<span class="dropdown-button">'
                                + '<span id="headingButtonText">' + self.defaultButtonText + '</span>'
                                + '<i class="fa fa-chevron-down headingArrow"></i>'
                            +'</span>'
                        + '</button>'
                        + '<ul class="dropdown-menu">'
                            + '<li>'
                                +'<button type="button" data-type="head1" class="head1">h1.Heading 1</button>'
                            +'</li>'
                            + '<li>'
                                + '<button type="button" data-type="head2" class="head2">h2.Heading 2</button>'
                            + '</li>'
                            + '<li>'
                                + '<button type="button" data-type="head3" class="head3">h3.text</button>'
                            + '</li>'
                        + '</ul>';

                    this.button = this.document.createElement('div');
                    this.button.classList.add('dropdown');
                    this.button.classList.add('medium-editor-action');
                    this.button.classList.add('medium-editor-dropdown-container');
                    this.button.innerHTML = buttonHtml;

                    this.on(this.button, 'click', this.handleClick.bind(this));
                    this.subscribe('showToolbar', this.handleShowToolbar.bind(this));
                    this.subscribe('editableInput', this.handleShowToolbar.bind(this));
                },
                handleClick: function (event)
                {

                    event.preventDefault();

                    if (!event.target || !event.target.getAttribute) {
                        return;
                    }

                    let targetElement = event.target;

                    if (targetElement.getAttribute('data-type') !== 'head1'
                        && targetElement.getAttribute('data-type') !== 'head2'
                        && targetElement.getAttribute('data-type') !== 'head3'
                    ) {
                        self.toggleDropdownMenu(targetElement);
                    } else if (targetElement.getAttribute('data-type') === 'head1') {
                        document.getElementById('headingButtonText').innerHTML = 'h1.Heading 1';
                        this.execAction('append-h1');
                        self.toggleDropdownMenu(targetElement);
                    } else if (targetElement.getAttribute('data-type') === 'head2') {
                        document.getElementById('headingButtonText').innerHTML = 'h2.Heading 2';
                        this.execAction('append-h3');
                        self.toggleDropdownMenu(targetElement);
                    } else if (targetElement.getAttribute('data-type') === 'head3') {
                        document.getElementById('headingButtonText').innerHTML = 'h3.text';
                        let range = MediumEditor.selection.getSelectionRange(this.document);

                        if (range.startContainer.parentNode.nodeName.toLocaleLowerCase() === 'h1') {
                            this.execAction('append-h1');
                        } else if (range.startContainer.parentNode.nodeName.toLocaleLowerCase() === 'h3') {
                            this.execAction('append-h3');
                        }
                        self.toggleDropdownMenu(targetElement);
                    } else {
                        self.toggleDropdownMenu(targetElement);
                        return;
                    }
                },
                handleShowToolbar: function(event)
                {
                    if (!MediumEditor.selection || !MediumEditor.selection.getSelectionRange(this.document)) {
                        return;
                    }

                    let range = MediumEditor.selection.getSelectionRange(this.document);

                    if (range.startContainer.parentNode.nodeName.toLocaleLowerCase() === 'h1') {
                        document.getElementById('headingButtonText').innerHTML = 'h1.Heading 1';
                    } else if (range.startContainer.parentNode.nodeName.toLocaleLowerCase() === 'h3') {
                        document.getElementById('headingButtonText').innerHTML = 'h2.Heading 2';
                    }  else if (range.startContainer.parentNode.nodeName.toLocaleLowerCase() === 'p') {
                        document.getElementById('headingButtonText').innerHTML = 'h3.text';
                    } else {
                        document.getElementById('headingButtonText').innerHTML = self.defaultButtonText;
                    }
                }
        });

        this.headingExtension = new customHeadingExtension();
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

    getHeadingExtension() {
        return this.headingExtension;
    }
}
