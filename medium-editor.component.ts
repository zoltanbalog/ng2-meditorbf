import { Component, Input, forwardRef, ElementRef, ViewChild, OnChanges, OnInit, OnDestroy, ViewEncapsulation, Output, EventEmitter, Renderer, AfterViewInit, AfterViewChecked } from '@angular/core';
import * as MediumEditor from './src/MediumEditor/js/medium-editor';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { HeadingExtension } from "./src/Extension/heading-extension";
import { ColorPickerExtension } from "./src/Extension/color-picker.extension";
import { CleanFormatExtension } from "./src/Extension/clean-format-extension";
import { DividerExtension } from "./src/Extension/divider.extension";

@Component({
    selector: 'medium-editor',
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => MediumEditorComponent),
        multi: true
    }],
    encapsulation: ViewEncapsulation.None,
    template: `
        <div class="meditor-bf-container">
            <div #host></div>
            <div class="floating-add-buttons" [class.active]="!isShowAddButtons"
                 [class.insert-button-visibile]="!isInsertButtonHidden">
                <div class="floating-button" (click)="showAddButtons()">
                    <i class="icn icn-cross" aria-hidden="true"></i>
                </div>
                <ul class="list-unstyled">
                    <li class="floating-btn" (click)="startAddPicture()">
                        <i class="icn icn-add_picture" aria-hidden="true"></i>
                        <p>Pictures</p>
                    </li>
                    <!-- <li class="floating-btn">
                       <i class="icn icn-add_collage" aria-hidden="true"></i>
                       <p>Collage</p>
                     </li>-->
                    <li class="floating-btn" (click)="startAddMedia()">
                        <i class="icn icn-add_video" aria-hidden="true"></i>
                        <p>Video</p>
                    </li>
                </ul>
            </div>    
        </div>
    `,
    styleUrls: [
        './src/MediumEditor/css/font-awesome.min.css',
        './src/MediumEditor/css/medium-editor.css',
        './src/MediumEditor/css/add-media.css',
        './src/MediumEditor/css/pins.css',
        './src/MediumEditor/css/picture-options.css',
    ]
})
export class MediumEditorComponent implements ControlValueAccessor, OnInit, OnDestroy, OnChanges {
    @ViewChild('host') host: any;

    @Input() options: any;
    @Input() placeholder: string;
    @Input() mode: string;
    @Input() thumbImageUrl;
    @Input() cleanAttrs;
    @Input() cleanTags;
    @Input() unwrapTags;

    @Input()
    set images(images) {
        if (images) {
            images.forEach(img => {
                this.addToContent(this.generateImageContainer(img));
            });
            this.removePlaceholder();
            this.removeMediumInsert();
        }
    }

    @Input()
    set media(media) {
        if (media) {
            this.addToContent(media);
            this.removePlaceholder();
            this.removeMediumInsert();
        }
    }

    @Input()
    set restore(restore) {
        if (restore > 0) {
            this.restoreImagesOptionsHTML();
        }
    }

    @Input()
    set pastedEmbedElem(pastedEmbedElem) {
        if (pastedEmbedElem && pastedEmbedElem.type && pastedEmbedElem.elem && pastedEmbedElem.target) {
            if (pastedEmbedElem.type == 'append') {
                pastedEmbedElem.target.appendChild(pastedEmbedElem.elem);
            } else if (pastedEmbedElem.type == 'insert') {
                pastedEmbedElem.target.insertAdjacentHTML('beforebegin', pastedEmbedElem.elem.innerHTML);
            }
        }
    }

    @Input()
    set removeImage(removeImage) {
        if (removeImage) {
            this.deletePicture(removeImage);
        }
    }

    @Input()
    set uploadedImageData(uploadedImageData) {
        if (uploadedImageData) {
            if (this.featuredImage === uploadedImageData.id && Number.isInteger(uploadedImageData.data.id)) {
                this.featuredImage = uploadedImageData.data.id;
                this.featuredImageChanged();
            } else if (this.featuredImage === uploadedImageData.id) {
                this.featuredImage = 3;
                this.featuredImageChanged();
            }
            let pinnableContainer = this.elementRef.nativeElement.querySelector('div[data-img-original-id="'+uploadedImageData.id+'"]');
            if (pinnableContainer) {
                pinnableContainer.setAttribute('data-img-original-id', uploadedImageData.data.id);
                let image = pinnableContainer.querySelector('.post-image');
                image.setAttribute('data-original-id', uploadedImageData.data.id);
                pinnableContainer.setAttribute('data-width', uploadedImageData.data.resized_width);
                pinnableContainer.setAttribute('data-height', uploadedImageData.data.resized_height);

            }
        }
    }

    // Triggering events
    @Output() changeEvent = new EventEmitter<any>();
    @Output() focusEvent = new EventEmitter<any>();
    @Output() keyUpEvent = new EventEmitter<any>();
    @Output() keypressEvent = new EventEmitter<any>();
    @Output() keyDownEvent = new EventEmitter<any>();
    @Output() clickEvent = new EventEmitter<any>();
    @Output() blurEvent = new EventEmitter<any>();
    @Output() pasteEvent = new EventEmitter<any>();
    @Output() startAddPictureEvent = new EventEmitter<any>();
    @Output() startAddMediaEvent = new EventEmitter<any>();
    @Output() featuredImageChangedEvent = new EventEmitter<any>();
    @Output() lastOpenedPinChangedEvent = new EventEmitter<any>();
    @Output() imageIsNotPinnableEvent = new EventEmitter<any>();
    @Output() pasteEmbedMediaEvent = new EventEmitter<any>();
    @Output() pasteImageEvent = new EventEmitter<any>();

    propagateChange = (_: any) => { };
    editor: any;

    isShowAddButtons: boolean = true; // Show adds button (add image, collage, embed media)
    isInsertButtonHidden: boolean = true; // Show / Hide insert (+) button

    lastShowedImageOptionMenuId: any = null; // Last showed image option menu id
    isWaitingForPin: boolean = false; // Add pin interface active
    lastOpenedPin: any = null; // Last opened pin
    pin: string = ""; // The pin list in json format

    featuredImage: number = 3; // Featured image id
    imageCounter: number = 1; // Image counter in current post

    globalClickListenFunc: Function; // Global click event listeners
    globalMouseOverListenFunc: Function; // Global mouseover event listeners
    globalMouseOutListenFunc: Function; // Global mouseout event listeners
    dragStartListeners: Function;
    dropListeners: Function;

    isImageOptionMenuRestored = false; // Image option menus is restored (only edit)

    lastDraggedElement: any = null;

    autoFocusRun = false;

    constructor(
        private elementRef: ElementRef,
        private renderer: Renderer
    ) {}

    ngOnInit() {
        this.options = (typeof this.options === 'string') ? JSON.parse(this.options)
            : (typeof this.options === 'object') ? this.options : {};
        if (this.placeholder && this.placeholder !== '') {
            Object.assign(this.options, {
                placeholder: { text: this.placeholder }
            });
        }

        this.setExtensions();

        this.editor = new MediumEditor(this.host.nativeElement, this.options);

        if (this.editor.elements[0].innerHTML === '') {
            this.editor.elements[0].innerHTML = '<p><br /></p>';
        }

        this.setGlobalEventListeners();
        this.registerEventListeners();
        this.setDragNDropListeners();
    }

    ngAfterViewInit() {
    }

    ngAfterViewChecked() {
        if (this.mode && this.mode === "edit" && !this.isImageOptionMenuRestored) {
            this.restoreImagesOptionsHTML();
        }
        if (!this.autoFocusRun
            && this.editor.elements[0]
            && this.elementHasClass(this.editor.elements[0], 'medium-editor-element')
            && this.editor.elements[0].querySelector('p')
            && document.querySelector('.floating-add-buttons')
        ) {
            setTimeout(()=>{
                this.editor.elements[0].focus();
                let firstPElement = this.editor.elements[0].querySelector('p');
                this.addMediaInsertRow({'target': firstPElement});
                this.autoFocusRun = true;
            }, 0);
        }
    }

    ngOnDestroy() {
        if (this.editor) {
            this.editor.destroy();
        }

        this.globalClickListenFunc();
        this.globalMouseOverListenFunc();
        this.globalMouseOutListenFunc();
        this.dragStartListeners();
        this.dropListeners();
    }

    ngOnChanges(changes: any) {
        this.propagateChange(changes);
    }

    /**
     * Restore image options menu, button and add pin tooltip to edit post
     */
    restoreImagesOptionsHTML() {
        let mediumEditor = this.editor.elements[0]; // this.elementRef.nativeElement.querySelector('.medium-editor-element');
        if (!mediumEditor) {
            return;
        }

        let pinnableImageRows = mediumEditor.querySelectorAll('.pinnable-image-row');
        if (!pinnableImageRows || pinnableImageRows.length < 1) {
            return;
        }

        this.isImageOptionMenuRestored = true;

        for (let pinnableImageRow of pinnableImageRows) {
            let actualId = pinnableImageRow.getAttribute('data-img-id');
            let pinListDiv = pinnableImageRow.querySelector('.pin-list');
            let imageOptionDataHtml = this.generateImageOptionDataHtml(actualId);
            pinListDiv.insertAdjacentHTML('beforeend', imageOptionDataHtml);

            let postImage = pinnableImageRow.querySelector('.post-image');
            if (parseInt(postImage.getAttribute('data-id'), 10) > this.imageCounter) {
                this.imageCounter = parseInt(postImage.getAttribute('data-id'), 10);
            }
        }

        // let imageCaptions = this.elementRef.nativeElement.querySelectorAll('.img-caption');
        // if (imageCaptions && imageCaptions.length > 0) {
        //     for (let imageCaption of imageCaptions) {
        //         imageCaption.setAttribute('contenteditable', true);
        //     }
        // }

        this.imageCounter += 1;
    }

    registerEventListeners() {
        this.editor.subscribe('editableInput', (event: any, element: any) => {
            let value = this.editor.elements[0].innerHTML;
            this.ngOnChanges(value);
            this.changeEvent.emit({'event': event, 'target': element});
        });
        this.editor.subscribe('focus', (event: any, element: any) => {
            this.focusEvent.emit({'event': event, 'target': element});
        });
        this.editor.subscribe('editableKeyup', (event: any, element: any) => {
            this.keyUpEvent.emit({'event': event, 'target': element});
            this.addMediaInsertRow(event);
            this.setEditorKeyupEventListeners(event);
        });
        this.editor.subscribe('editableKeypress', (event: any, element: any) => {
            this.keypressEvent.emit({'event': event, 'target': element});
            this.addMediaInsertRow(event);
            this.setEditorKeypressEventListeners(event);
        });
        this.editor.subscribe('editableKeydown', (event: any, element: any) => {
            this.keyDownEvent.emit({'event': event, 'target': element});
            this.addMediaInsertRow(event);
        });
        this.editor.subscribe('editableClick', (event: any, element: any) => {
            this.clickEvent.emit({'event': event, 'target': element});
            this.addMediaInsertRow(event);
            this.setEditorClickEventListeners(event);
        });
        this.editor.subscribe('blur', (event: any, element: any) => {
            // this.setEditorBlurEventListener(event);
            this.blurEvent.emit({'event': event, 'target': element});
        });
        // this.editor.subscribe('editablePaste', (event: any, element: any) => {
        this.renderer.listen(this.editor.elements[0], 'paste', (event) => {
            // this.setPasteEventListeners(event);
            this.createPasteBin(this.editor.elements[0], event);
            this.pasteEvent.emit({'event': event, 'target': event.target});
        });

    }

    setGlobalEventListeners() {
        this.globalClickListenFunc = this.renderer.listenGlobal('document', 'click', (event) => {
            if ((!this.isInsertButtonHidden || this.isShowAddButtons)
                && this.elementHasClass(event.target, 'medium-editor-element') == false
                && !this.closestElementByClass(event.target, 'medium-editor-element')
                && this.elementHasClass(event.target, 'floating-add-buttons') == false
                && !this.closestElementByClass(event.target, 'floating-add-buttons')
            ) {
                this.hideInsertButton();
                this.hideAddButtons();
            }
            if (!event.target || !event.target || event.target.getAttribute || event.target.getAttribute('dynamicClick')) {
                this.setImageDefaultStateClick(event.target);
            }

            if(!this.isWaitingForPin
                && (this.closestElementByClass(event.target, 'pin-row-list-element')
                || this.elementHasClass(event.target, 'pin-row-list-element'))
                && !(this.elementHasClass(event.target, 'pin-rows-edit-pin')
                || this.closestElementByClass(event.target, 'pin-rows-edit-pin'))
            ) {
                let rowPoint = this.elementHasClass(event.target, 'pin-row-list-element') ? event.target : this.closestElementByClass(event.target, 'pin-row-list-element');
                if (rowPoint) {
                    this.renderer.listen(rowPoint, 'click', (event) => {
                        let goToStore = rowPoint.querySelector('.pin-rows-go-to-store');
                        if (goToStore && goToStore.getAttribute && goToStore.getAttribute('href')) {
                            // Create link in memory
                            var a = window.document.createElement("a");
                            a.target = '_blank';
                            a.href = goToStore.getAttribute('href');

                            // Dispatch fake click
                            var e = window.document.createEvent("MouseEvents");
                            e.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                            a.dispatchEvent(e);
                        }
                    });
                }
            }
        });

        this.globalMouseOverListenFunc = this.renderer.listenGlobal('document', 'mouseover', (event) => {
            if (!this.elementHasAttribute(event.target, 'dynamicMouseOver') || !this.isWaitingForPin) {
                return;
            }
            event.defaultPrevented;

            switch (event.target.getAttribute('dynamicMouseOver')) {
                case 'showSavedPin()':
                    this.showSavedPin(event.target);
                    break;
            }
        });

        this.globalMouseOutListenFunc = this.renderer.listenGlobal('document', 'mouseout', (event) => {

            if (!this.elementHasAttribute(event.target, 'dynamicMouseOut') || !this.isWaitingForPin) {
                return;
            }
            event.defaultPrevented;

            let overAction = event.target.getAttribute('dynamicMouseOut');
            switch (overAction) {
                case 'hideSavedPin()':
                    this.hideSavedPin(event.target);
                    break;
            }
        });
    }

    setDragNDropListeners() {
        this.dragStartListeners = this.renderer.listen(this.editor.elements[0], 'dragstart', (event) => {
            let target = event.target;
            if (this.elementHasClass(target, 'pinnable-image-row')) {
                this.lastDraggedElement = target;
            } else if (this.closestElementByClass(event.target, 'pinnable-image-row')) {
                this.lastDraggedElement = this.closestElementByClass(event.target, 'pinnable-image-row')
            } else {
                this.lastDraggedElement = null;
                return;
            }
        });

        this.dropListeners = this.renderer.listen(this.editor.elements[0], 'drop', (event) => {
            event.preventDefault();

            let target = event.target;
            if (this.closestElementByClass(target, 'medium-editor-element') == false && (!target.classList || !target.classList.contains('medium-editor-element'))) {
                return;
            }

            if (this.closestElementByClass(target, 'pinnable-image-row') != false || (target.classList && target.classList.contains('pinnable-image-row'))) {
                return;
            }

            let range = null;
            if (document.caretRangeFromPoint) { // Chrome
                range = document.caretRangeFromPoint(event.clientX, event.clientY);
            } else if (event.rangeParent) { // Firefox
                range = document.createRange();
                range.setStart(event.rangeParent, event.rangeOffset);
            }
            let sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('insertHTML', false, this.lastDraggedElement.outerHTML);
            sel.removeAllRanges();
            this.lastDraggedElement.remove();
            this.lastDraggedElement = null;

            this.setImageDefaultState();
        });
    }

    // setEditorBlurEventListener(event) {
    //     if (this.elementHasClass(event.target, 'img-caption')) {
    //         this.setImageCaptionData(event.target.getAttribute('data-image-id'), event.target.textContent.trim());
    //     }
    // }

    setEditorKeyupEventListeners(event) {
        // if (this.elementHasClass(event.target, 'img-caption')) {
        //     this.setImageCaptionData(event.target.getAttribute('data-image-id'), event.target.textContent.trim());
        // } else

        if (this.elementHasClass(event.target, 'product')
            || this.elementHasClass(event.target, 'store')
            || this.elementHasClass(event.target, 'tags')
            || this.elementHasClass(event.target, 'link')
        ) {
            this.validatePinDetails(event.target);
        }
    }

    setEditorKeypressEventListeners(event) {
        if (this.elementHasClass(event.target, 'product')
            || this.elementHasClass(event.target, 'store')
            || this.elementHasClass(event.target, 'tags')
            || this.elementHasClass(event.target, 'link')
        ) {
            this.validatePinDetails(event.target);
        }
    }

    setPasteEventListeners(event) {
        let mediumInsertActives = document.querySelectorAll('.medium-insert-active');
        if (mediumInsertActives) {
            for (let i = 0; i < mediumInsertActives.length; i++) {
                mediumInsertActives[i].classList.remove('medium-insert-active');
            }
        }

        let clipboardData = this.getClipboardContent(event);
        if (clipboardData['text/html']) {

            if (//this.elementHasClass(event.target, 'img-caption') ||
                this.elementHasClass(event.target, 'pinnable-image-row')
                || this.closestElementByClass(event.target, 'pinnable-image-row')
            ) {
                return;
            }

            event.preventDefault();

            let elem = document.createElement("p");
            elem.innerHTML = clipboardData['text/html'];

            let allElements = elem.querySelectorAll('*');
            for (let i = 0; i < allElements.length; i += 1) {
                let workEl = allElements[i];

                if ('a' === workEl.nodeName.toLowerCase()) {
                    workEl.setAttribute('target', '_blank');
                }

                this.cleanupAttrs(workEl);
                this.cleanupTags(workEl);
                this.unwrap(workEl);
            }

            this.changeImageSrc(elem.getElementsByTagName('img'));

            if (event.target.classList && event.target.classList.contains('medium-editor-element')) {
                event.target.appendChild(elem);
            } else {
                event.target.insertAdjacentHTML('afterend', elem.outerHTML);
            }
        // } else if (this.elementHasClass(event.target, 'img-caption')) {
        //     this.setImageCaptionData(event.target.getAttribute('data-image-id'), event.target.textContent.trim());
        } else if (clipboardData['text/plain']) {
            if (this.isAnYoutubeUrl(clipboardData['text/plain'])) {
                event.preventDefault();
                this.pasteEmbedMediaEvent.emit({'event': event, 'data': clipboardData['text/plain']});
            }
        }

        this.removePlaceholder();
    }

    setEditorClickEventListeners(event) {
        if (event.target && event.target && event.target.getAttribute && event.target.getAttribute('dynamicClick')) {
            event.defaultPrevented;

            switch (event.target.getAttribute('dynamicClick')) {
                case 'toggleImageOptionMenu()':
                    this.toggleImageOptionMenu(event);
                    break;

                case 'togglePinTooltipOutInWYSIWYGModeByRow()':
                    this.togglePinTooltipOutInWYSIWYGModeByRow(event);
                    break;

                case 'startWaitForPin()':
                    this.startWaitForPin();
                    break;

                case 'addNewPin()':
                    this.addNewPin(event);
                    break;

                case 'togglePinTooltip()':
                    this.togglePinTooltip(event);
                    break;

                case 'savePin()':
                    this.savePin(this.closestElementByClass(event.target, 'add-pin-form'));
                    break;

                case 'setFeaturedImage()':
                    this.setFeaturedImage(event);
                    break;

                case 'deletePicture()':
                    this.deletePicture(event.target);
                    break;

                case 'editPinByRow()':
                    this.editPinByRow(event);
                    break;

                case 'removeSavedPinByRow()':
                    this.removeSavedPinByRow(event);
                    break;

                case 'alignImageLeft()':
                    this.alignImage(event.target, 'left');
                    break;

                case 'alignImageCenter()':
                    this.alignImage(event.target, 'center');
                    break;

                case 'imageFitToPage()':
                    this.imageFitToPage(event.target);
                    break;

                default:
                    this.setImageDefaultStateClick(event.target);
            }
        }

        // if (this.elementHasClass(event.target, 'img-caption')) {
        //     this.setImageCaptionData(event.target.getAttribute('data-image-id'), event.target.textContent.trim());
        // }
    }

    setExtensions() {
        if (!this.options || !this.options.toolbar || !this.options.toolbar.buttons) {
            return;
        }
        for (let i = 0; i < this.options.toolbar.buttons.length; i++) {
            if (this.options.toolbar.buttons[i] === 'headingExtension') {
                let headingExtensionService = new HeadingExtension();
                if (this.options.extensions) {
                    this.options.extensions['headingExtension'] = headingExtensionService.getHeadingExtension();
                } else {
                    this.options.extensions = {'headingExtension': headingExtensionService.getHeadingExtension()};
                }
            } else if (this.options.toolbar.buttons[i] === 'colorPicker') {
                let colorPickerExtensionService = new ColorPickerExtension();

                if (this.options.extensions) {
                    this.options.extensions['colorPicker'] = colorPickerExtensionService.getPickerExtension();
                } else {
                    this.options.extensions = {'colorPicker': colorPickerExtensionService.getPickerExtension()};
                }
            } else if (this.options.toolbar.buttons[i] === 'cleanFormatExtension') {
                let cleanFormatExtensionService = new CleanFormatExtension();
                cleanFormatExtensionService.setCleanupAttrs(this.cleanAttrs);

                if (this.options.extensions) {
                    this.options.extensions['cleanFormatExtension'] = cleanFormatExtensionService.getCleanFormatExtension();
                } else {
                    this.options.extensions = {'cleanFormatExtension': cleanFormatExtensionService.getCleanFormatExtension()};
                }
            } else if ((typeof this.options.toolbar.buttons[i]) == 'string' && this.options.toolbar.buttons[i].startsWith('dividerExtension')) {
                let dividerExtensionService = new DividerExtension();
                let key = this.options.toolbar.buttons[i];

                if (this.options.extensions) {
                    this.options.extensions[key] = dividerExtensionService.getDividerExtension();
                } else {
                    this.options.extensions = {key: dividerExtensionService.getDividerExtension()};
                }
            }
        }
    }

    writeValue(value: any) {
        if (this.editor) {
            if (value && value !== '') {
                this.editor.setContent(value);
            }
        }
    }

    registerOnChange(fn: any) {
        this.propagateChange = fn;
    }

    registerOnTouched(fn: any) { }

    /* Media buttons start */

    removeMediumInsert() {
        let mediumInsertActivElement = this.elementRef.nativeElement.querySelector('.medium-insert-active');
        if (this.elementHasClass(mediumInsertActivElement, 'medium-insert-active')) {
            mediumInsertActivElement.classList.remove('medium-insert-active');
        }
    }

    addMediaInsertRow(event) {
        let targetElement = event.target;
        let selection = window.getSelection();
        let range;
        let current;
        let paragraph;

        if (!selection || selection.rangeCount === 0) {
            current = targetElement;
        } else {
            range = selection.getRangeAt(0);
            current = range.commonAncestorContainer;
        }
        // When user clicks on editor's placeholder in FF, current el is editor itself, not the first paragraph as it should
        if (this.elementHasClass(current, 'medium-editor-element')) {
            current = current.querySelector('p');
        }

        paragraph = current && current.tagName && current.tagName === "P" ? current : this.closestElementByTagname(current, 'P');

        this.hideInsertButton();
        this.hideAddButtons();

        // if (this.elementHasClass(targetElement, 'medium-editor-placeholder') === false) {
        this.removeMediumInsert();
        if (this.elementHasClass(targetElement, 'pinnable-image-row') !== false
            || this.closestElementByClass(targetElement, 'pinnable-image-row')
            || this.elementHasClass(targetElement, 'embed-media-frame') !== false
            || this.closestElementByClass(event.target, 'embed-media-frame')
        ) {
            return;
        }
        if (paragraph && paragraph.outerHTML && paragraph.textContent.trim() === '') {
            paragraph.classList.add('medium-insert-active');
            this.showInsertButton();
        }
        // }
    }

    calculateInsertButtonPosition() {
        let targetElement = this.elementRef.nativeElement.querySelector('.medium-insert-active');
        return {'xpos': -40, 'ypos': targetElement.offsetTop};
    }

    showInsertButton() {
        let position = this.calculateInsertButtonPosition();
        let insertButton = this.elementRef.nativeElement.querySelector('.floating-add-buttons');
        if (!insertButton) {
            return;
        }
        insertButton.style.top = position.ypos + 'px';
        insertButton.style.left = position.xpos + 'px';
        this.isInsertButtonHidden = false;
    }

    hideInsertButton() {
        this.isInsertButtonHidden = true;
    }

    showAddButtons() {
        this.isShowAddButtons = !this.isShowAddButtons;
    }

    hideAddButtons() {
        this.isShowAddButtons = true;
    }

    startAddPicture() {
        this.startAddPictureEvent.emit();
    }

    startAddMedia() {
        this.startAddMediaEvent.emit();
    }

    /* Media buttons end */

    /* Insert media start */

    addToContent(newContent) {
        this.hideAddButtons();
        let insertionTarget = this.elementRef.nativeElement.querySelector('.medium-insert-active');
        if (!insertionTarget || insertionTarget === null || insertionTarget === undefined) {
            return;
        }
        insertionTarget.insertAdjacentHTML('beforeend', newContent);
        // this.content = this.editor.elements[0].innerHTML; // TODO ellenőrizni a végén
    }

    /**
     * Generate image options data HTML (menu, menu button and add pin hint)
     *
     * @param actualId The actual image id
     * @returns {string} The generated image options data HTML
     */
    generateImageOptionDataHtml(actualId) {
        let imageOptionMenuId = actualId + 'Menu';
        let imageOptionButtonId = actualId + 'MenuButton';

        return  '<span class="meditor-tooltiptext">Click on the image</span>'
            + '<button id="' + imageOptionButtonId + '" class="post-image-option-button" data-menu-id="' + imageOptionMenuId + '" dynamicClick="toggleImageOptionMenu()">'
            + '<i dynamicClick="toggleImageOptionMenu()" class="icn icn-bullets"></i>'
            + '</button>'
            + '<div id="' + imageOptionMenuId + '" class="post-image-options" data-button-id="' + imageOptionButtonId + '">'
            + '<div class="center-btn">'
            + '<ul class="list-inline center">'
            + '<li id="' + actualId + 'Featured" class="set-featured first">'
            + '<a class="post-image-option-element" data-disable-preview="true">'
            + '<i dynamicClick="setFeaturedImage()" class="icn icn-prefer_picture"></i>'
            + '<p>Prefer</p>'
            + '</a>'
            + '</li>'
            + '<li id="' + actualId + 'AddPin" class="add-pin">'
            + '<a class="post-image-option-element" data-disable-preview="true">'
            + '<i dynamicClick="startWaitForPin()" class="icn icn-add_pin"></i>'
            + '<p>Pin</p>'
            + '</a>'
            + '</li>'
            + '<li id="' + actualId + 'DeletePicture" class="delete-picture">'
            + '<a class="post-image-option-element" data-disable-preview="true">'
            + '<i dynamicClick="deletePicture()" class="icn icn-del_pic"></i>'
            + '<p>Delete</p>'
            + '</a>'
            + '</li>'
            + '<li class="img-align-button">'
            + '<a class="post-image-option-element" data-disable-preview="true">'
            + '<i dynamicClick="alignImageLeft()" class="fa fa-align-left"></i>'
            + '<p>Align left</p>'
            + '</a>'
            + '</li>'
            + '<li class="img-align-button active">'
            + '<a class="post-image-option-element" data-disable-preview="true">'
            + '<i dynamicClick="alignImageCenter()" class="fa fa-align-justify"></i>'
            + '<p>Center</p>'
            + '</a>'
            + '</li>'
            + '<li class="img-align-button">'
            + '<a class="post-image-option-element" data-disable-preview="true">'
            + '<i dynamicClick="imageFitToPage()" class="fa fa-align-right"></i>'
            + '<p>Fit to page</p>'
            + '</a>'
            + '</li>'
            + '</ul>'
            + '</div>'
            + '</div>';
    }

    generateImageContainer(img) {
        let actualId = "postImage" + this.imageCounter;

        let featuredClass = '';
        if (this.featuredImage === 3 && (Number.isInteger(img.id) || img.id.substr(0, 3) === 'tmp')) {
            this.featuredImage = img.id;
            featuredClass = 'featured-image';
            this.featuredImageChanged();
        }

        let content = ''
            + '<div class="row pinnable-image-row image-align-center ' + featuredClass + '" style="display: inline-block" draggable="true" contenteditable="false" data-img-id="' + actualId + '" data-img-original-id="' + img.id + '" data-width="' + img.resized_width + '" data-height="' + img.resized_height + '">'
            + '<div class="image-content-container">'
            + '<div class="pin-container cd-product cd-container" >'
            + '<div class="pin-list cd-product-wrapper">'
            + '<img dynamicClick="addNewPin()" id="' + actualId + '"  data-original-id="' + img.id + '" class="post-image" data-id="' + this.imageCounter + '" src="' + img.src + '"/>'
            + '<ul id="' + actualId + 'Ul" class="pin-point-list">'
            + '</ul>'
            + this.generateImageOptionDataHtml(actualId)
            + '</div>'
            + '</div>'
            // + '<figcaption id="' + actualId + 'Caption" class="img-caption" data-image-id="' + actualId + '" contenteditable="true" placeholder="Write your image caption here"></figcaption>'
            + '<ul id="' + actualId + 'RowsUl" class="pin-row-list" contenteditable="false">'
            + '</ul>'
            + '</div>'
            + '</div>'
            + '<p><br/></p>';

        this.imageCounter++;
        return content;
    }

    /* Insert media end */

    /* Actions on media start */

    /**
     * Open image option menu
     *
     * @param optionMenuElement the image option menu
     */
    openImageOptionMenu(optionMenuElement) {
        if (this.elementHasClassList(optionMenuElement)) {
            optionMenuElement.classList.add('active');
            this.lastShowedImageOptionMenuId = optionMenuElement.getAttribute("id");
        }
    }

    /**
     * Close image option menu
     *
     * @param optionMenuElement the opened image option menu
     */
    closeImageOptionMenu(optionMenuElement) {
        if (this.elementHasClass(optionMenuElement, 'active')) {
            optionMenuElement.classList.remove('active');
            this.lastShowedImageOptionMenuId = null;

            this.isWaitingForPin = false;
            this.lastOpenedPin = null;
            this.lastOpenedPinChanged();
        }
    }

    /**
     * Close last opened image option menu
     */
    closeLastOpenedImageOptionMenu() {
        if (this.lastShowedImageOptionMenuId !== null && this.elementExist('#' + this.lastShowedImageOptionMenuId)) {
            let lastShowedImageOptionElement = this.elementRef.nativeElement.querySelector('#' + this.lastShowedImageOptionMenuId);
            this.closeImageOptionMenu(lastShowedImageOptionElement);
        }
    }

    /**
     * Toggle image option menu
     *
     * @param event "three dot" button click event
     */
    toggleImageOptionMenu(event) {
        let imageOptionButton = event.target;

        if (imageOptionButton.tagName !== "BUTTON") {
            imageOptionButton = this.closestElementByClass(imageOptionButton, 'post-image-option-button');
        }

        if (!this.elementHasAttribute(imageOptionButton, 'data-menu-id')
            || !this.elementExist('#' + imageOptionButton.getAttribute('data-menu-id'))
        ) {
            return;
        }

        this.closeAllPinTooltip();
        let imageOptionMenuElement = this.elementRef.nativeElement.querySelector('#' + imageOptionButton.getAttribute('data-menu-id'));

        if (this.isWaitingForPin) {
            if (this.lastShowedImageOptionMenuId && this.elementExist('#' + this.lastShowedImageOptionMenuId)) {
                let lastImageOptionMenu = this.elementRef.nativeElement.querySelector('#' + this.lastShowedImageOptionMenuId);
                imageOptionButton = this.elementRef.nativeElement.querySelector('#' + lastImageOptionMenu.getAttribute('data-button-id'));
            }
            this.endWaitForPin(imageOptionButton);
            this.openImageOptionMenu(imageOptionMenuElement);
            // this.refreshMediumEditor(); // TODO ??
            return;
        }

        if (this.elementHasAttribute(imageOptionMenuElement, 'id')
            && this.lastShowedImageOptionMenuId === imageOptionMenuElement.getAttribute('id')
        ) {
            this.closeImageOptionMenu(imageOptionMenuElement);
        } else {
            this.closeLastOpenedImageOptionMenu();
            this.openImageOptionMenu(imageOptionMenuElement);
        }

    }

    /**
     * If the user clicks outside the picture then the overlay will be closed and the pins won't be saved.
     *
     * @param event Click event
     */
    setImageDefaultStateClick(targetElement) {
        if (this.closestElementByClass(targetElement, 'pin-container') || this.closestElementByClass(targetElement, 'pin-rows-edit-pin')
            || this.elementHasClass(targetElement, 'pin-container') || this.elementHasClass(targetElement, 'pin-rows-edit-pin')
            || this.elementHasClass(targetElement, 'not-close-pin-mode')
        ) {
            return;
        }

        this.setImageDefaultState();
    }

    setImageDefaultState() {
        if (this.isWaitingForPin && this.lastShowedImageOptionMenuId && this.elementExist('#' + this.lastShowedImageOptionMenuId)) {
            let lastImageOptionMenu = this.elementRef.nativeElement.querySelector('#' + this.lastShowedImageOptionMenuId);
            let imageOptionButton = this.elementRef.nativeElement.querySelector('#' + lastImageOptionMenu.getAttribute('data-button-id'));
            this.endWaitForPin(imageOptionButton);
            // this.refreshMediumEditor(); // TODO ??
            this.lastShowedImageOptionMenuId = null;
            this.isWaitingForPin = false;
            this.lastOpenedPin = null;
            this.lastOpenedPinChanged();
        } else if (this.lastShowedImageOptionMenuId) {
            this.closeLastOpenedImageOptionMenu();
        }
    }

    featuredImageChanged() {
        this.featuredImageChangedEvent.emit(this.featuredImage);
    }

    /**
     * Set image to featured
     *
     * @param event An image featured button click event
     */
    setFeaturedImage(event) {
        let featuredImageButton = event.target;
        let element = this.elementRef.nativeElement.querySelector('.featured-image');
        if (element) {
            element.classList.toggle('featured-image');
        }
        let pictureContainer = this.closestElementByClass(featuredImageButton, 'pinnable-image-row');
        pictureContainer.classList.toggle('featured-image');
        if (this.elementHasAttribute(pictureContainer, 'data-img-original-id')
            && (Number.isInteger(parseInt(pictureContainer.getAttribute("data-img-original-id")))
            || pictureContainer.getAttribute('data-img-original-id').substr(0, 3) === 'tmp')
        ) {
            this.featuredImage = parseInt(pictureContainer.getAttribute("data-img-original-id"));
            this.featuredImageChanged();
        }

        this.closeLastOpenedImageOptionMenu();
    }

    /**
     * Remove image from the post
     *
     * @param target The removable image
     */
    deletePicture(target) {
        let pictureContainer = this.closestElementByClass(target, 'pinnable-image-row');
        if (!pictureContainer) {
            this.closeLastOpenedImageOptionMenu();
            return;
        }

        if (!this.elementHasClass(pictureContainer, 'featured-image')) {
            pictureContainer.remove();
            this.closeLastOpenedImageOptionMenu();
            return;
        }

        if (!this.elementHasAttribute(pictureContainer, 'data-img-original-id')
            || isNaN(parseInt(pictureContainer.getAttribute('data-img-original-id')))
            || parseInt(pictureContainer.getAttribute('data-img-original-id')) != this.featuredImage
        ) {
            pictureContainer.remove();
            this.closeLastOpenedImageOptionMenu();
            return;
        }

        pictureContainer.remove();
        let firstImage = this.elementRef.nativeElement.querySelector('.post-image');
        if (firstImage) {
            let pinnableImageRow = this.closestElementByClass(firstImage, 'pinnable-image-row');
            pinnableImageRow.classList.add('featured-image');
            let id = parseInt(firstImage.getAttribute("data-original-id"));
            if (!isNaN(id)) {
                this.featuredImage = parseInt(firstImage.getAttribute("data-original-id"));
            } else {
                this.featuredImage = 3;
            }
        } else {
            this.featuredImage = 3;
        }
        this.closeLastOpenedImageOptionMenu();
        this.featuredImageChanged();
    }

    // /**
    //  * Set image data alt and title attribute by caption
    //  *
    //  * @param imgId The image id
    //  * @param data The caption data
    //  */
    // setImageCaptionData(imgId, data) {
    //     let image = this.elementRef.nativeElement.querySelector('#' + imgId);
    //     image.setAttribute('alt', data);
    //     image.setAttribute('title', data);
    // }

    /**
     * Align image
     *
     * @param targetElement An align button from target image
     * @param direction Align direction
     */
    alignImage(targetElement, direction) {
        let pinnableImageRow = this.closestElementByClass(targetElement, 'pinnable-image-row');
        let directionClass = {
            'left': 'image-align-left',
            'center': 'image-align-center',
        };

        if (this.elementHasClass(pinnableImageRow, 'image-align-left')) {
            pinnableImageRow.classList.remove('image-align-left');
        }

        if (this.elementHasClass(pinnableImageRow, 'image-align-center')) {
            pinnableImageRow.classList.remove('image-align-center');
        }

        if (this.elementHasClass(pinnableImageRow, 'image-fit-to-page')) {
            pinnableImageRow.classList.remove('image-fit-to-page');
        }

        pinnableImageRow.classList.add(directionClass[direction]);

        let activeAlignButton = pinnableImageRow.querySelector('.img-align-button.active');
        if (activeAlignButton) {
            activeAlignButton.classList.remove('active');
        }

        if (!this.elementHasClass(targetElement, 'img-align-button')) {
            targetElement = this.closestElementByClass(targetElement, 'img-align-button');
        }
        targetElement.classList.add('active');

        this.closeLastOpenedImageOptionMenu();
        // this.refreshMediumEditor(); // TODO ???
    }

    imageFitToPage(targetElement) {
        let pinnableImageRow = this.closestElementByClass(targetElement, 'pinnable-image-row');
        // if (!pinnableImageRow
        //      || !this.elementHasAttribute(pinnableImageRow, 'data-width') || pinnableImageRow.getAttribute('data-width') < 600
        //      || !this.elementHasAttribute(pinnableImageRow, 'data-height') || pinnableImageRow.getAttribute('data-height') < 600
        // ) {
        //     return;
        // }

        if (this.elementHasClass(pinnableImageRow, 'image-align-left')) {
            pinnableImageRow.classList.remove('image-align-left');
        }

        if (this.elementHasClass(pinnableImageRow, 'image-align-center')) {
            pinnableImageRow.classList.remove('image-align-center');
        }

        pinnableImageRow.classList.add('image-fit-to-page');

        let activeAlignButton = pinnableImageRow.querySelector('.img-align-button.active');
        if (activeAlignButton) {
            activeAlignButton.classList.remove('active');
        }

        if (!this.elementHasClass(targetElement, 'img-align-button')) {
            targetElement = this.closestElementByClass(targetElement, 'img-align-button');
        }
        targetElement.classList.add('active');

        this.closeLastOpenedImageOptionMenu();
        // this.refreshMediumEditor(); // TODO ???
    }

    /* Actions on media end */

    /* Edit \ Create pin start */

    lastOpenedPinChanged() {
        this.lastOpenedPinChangedEvent.emit(this.lastOpenedPin);
    }

    /**
     * Activate waiting for pin state
     */
    startWaitForPin() {
        if (this.lastShowedImageOptionMenuId === null || !this.elementExist('#' + this.lastShowedImageOptionMenuId)) {
            return;
        }

        let imageOptionMenu = this.elementRef.nativeElement.querySelector('#' + this.lastShowedImageOptionMenuId);
        let parentPinnableImgRow = this.closestElementByClass(imageOptionMenu, 'pinnable-image-row');
        let image = parentPinnableImgRow.querySelector('.post-image');

        if (parseInt(window.getComputedStyle(image,null).getPropertyValue("width"), 10) < 100
            || parseInt(window.getComputedStyle(image,null).getPropertyValue("height"), 10) < 100
        ) {
            this.imageIsNotPinnableEvent.emit();
            return;
        }

        imageOptionMenu.classList.remove('active');

        this.isWaitingForPin = true;

        this.showMeditorTooltip(parentPinnableImgRow);
        parentPinnableImgRow.classList.add('wait-for-pin');

        if (this.elementHasAttribute(imageOptionMenu, 'data-button-id')
            && this.elementExist('#' + imageOptionMenu.getAttribute('data-button-id'))
        ) {
            let imageOptionButton = this.elementRef.nativeElement.querySelector('#' + imageOptionMenu.getAttribute('data-button-id'));
            imageOptionButton.innerHTML = '<i dynamicClick="toggleImageOptionMenu()" class="icn icn-dots"></i>';
        }
    }

    /**
     * Deactivate waiting for pin state
     *
     * @param imageOptionMenu The actual image option menu
     */
    endWaitForPin(imageOptionButton) {
        this.removeLastOpenedUnsavedPin();
        this.isWaitingForPin = false;

        imageOptionButton.innerHTML = '<i dynamicClick="toggleImageOptionMenu()" class="icn icn-bullets"></i>';

        let parentPinnableImgRow = this.closestElementByClass(imageOptionButton, 'pinnable-image-row');
        if (parentPinnableImgRow) {
            this.hideMeditorTooltip(parentPinnableImgRow);
            if (this.elementHasClass(parentPinnableImgRow, 'wait-for-pin')) {
                parentPinnableImgRow.classList.remove('wait-for-pin');
            }
        }
    }

    /**
     * Show "how to add pin" tooltip in actual picture
     *
     * @param element Actual tooltip parent element
     */
    showMeditorTooltip(element) {
        let tooltipElement = element.querySelector('.meditor-tooltiptext');

        if (tooltipElement && this.elementHasClassList(tooltipElement)) {
            tooltipElement.classList.add('active');
        }
    }

    /**
     * Hide "how to add pin" tooltip in actual picture
     *
     * @param element Actual tooltip parent element
     */
    hideMeditorTooltip(element) {
        let tooltipElement = element.querySelector('.meditor-tooltiptext');

        if (tooltipElement && this.elementHasClass(tooltipElement, 'active')) {
            tooltipElement.classList.remove('active');
        }
    }

    /**
     * Set pin tooltip window direction
     *
     * @param targetElement The event target object
     */
    setPinTooltipDirection(targetElement) {
        let selectedPoint = this.closestElementByClass(targetElement, 'cd-single-point');
        let nextCdMoreInfo = selectedPoint.querySelector('.cd-more-info');

        let targetElementXPosition = 0;
        let targetElementYPosition = 0;
        while(targetElement) {
            targetElementXPosition += (targetElement.offsetLeft - targetElement.scrollLeft + targetElement.clientLeft);
            targetElementYPosition += (targetElement.offsetTop - targetElement.scrollTop + targetElement.clientTop);
            targetElement = targetElement.offsetParent;
        }

        let meditorElementXPosition = 0;
        let meditorElementYPosition = 0;
        let meditorElement = this.editor.elements[0]; // this.elementRef.nativeElement.querySelector('.medium-editor-element');
        while (meditorElement) {
            meditorElementXPosition += (meditorElement.offsetLeft - meditorElement.scrollLeft + meditorElement.clientLeft);
            meditorElementYPosition += (meditorElement.offsetTop - meditorElement.scrollTop + meditorElement.clientTop);
            meditorElement = meditorElement.offsetParent;
        }
        var X = targetElementXPosition - meditorElementXPosition;
        var Y = targetElementYPosition - meditorElementYPosition;

        if (this.elementHasClass(nextCdMoreInfo, 'cd-top')) {
            nextCdMoreInfo.classList.remove('cd-top');
        }
        if (this.elementHasClass(nextCdMoreInfo, 'cd-bottom')) {
            nextCdMoreInfo.classList.remove('cd-bottom');
        }
        if (this.elementHasClass(nextCdMoreInfo, 'cd-right')) {
            nextCdMoreInfo.classList.remove('cd-right');
        }

        if (X < 108) {
            nextCdMoreInfo.classList.add('cd-right');
            return;
        }

        if (Y < 220) {
            nextCdMoreInfo.classList.add('cd-bottom');
            return;
        }

        //Default:
        nextCdMoreInfo.classList.add('cd-top');
        return;

    }

    /**
     * Open a pin tooltip window
     *
     * @param selectedPoint The actual pin
     */
    openPinTooltip(selectedPoint) {
        if (selectedPoint) {
            selectedPoint.classList.add('is-open');
            let selectedRow = this.elementRef.nativeElement.querySelector('#' + selectedPoint.getAttribute('id') + 'Row');
            if (selectedRow) {
                selectedRow.classList.add('is-open');
            }
            this.lastOpenedPin = selectedPoint.getAttribute('id');
            this.lastOpenedPinChanged();
        }
    }

    /**
     * Close a pin tooltip window
     *
     * @param selectedPoint The actual pin
     */
    closePinTooltip(selectedPoint) {
        if (this.elementHasClass(selectedPoint, 'is-open')) {
            selectedPoint.classList.remove('is-open');
            let selectedRow = this.elementRef.nativeElement.querySelector('#' + selectedPoint.getAttribute('id') + 'Row');
            if (selectedRow) {
                selectedRow.classList.remove('is-open');
            }
            this.lastOpenedPin = null;
            this.lastOpenedPinChanged();
        }
    }

    /**
     * Close all pin tooltip window
     */
    closeAllPinTooltip() {
        let selectedPoints = this.elementRef.nativeElement.querySelectorAll('.cd-single-point');
        if (!selectedPoints || selectedPoints.length < 1) {
            return;
        }
        for (let selectedPoint of selectedPoints) {
            this.closePinTooltip(selectedPoint);
            this.removeUnsavedPin(selectedPoint);
        }
    }

    /**
     * Close last opened pin tooltip window
     */
    closeLastOpenedPinTooltip() {
        if (this.lastOpenedPin && this.lastOpenedPin != null && this.elementExist('#' + this.lastOpenedPin)) {
            let lastOpenedPinObject = this.elementRef.nativeElement.querySelector('#' + this.lastOpenedPin);

            if (this.isUpdatedPin(lastOpenedPinObject)) {
                this.closePinEditor(lastOpenedPinObject);
            }

            this.closePinTooltip(lastOpenedPinObject);
        }
    }

    /**
     * Toggle pin tooltip, if the pin is a saved pin remove this
     *
     * @param event The toggle pin event
     */
    togglePinTooltip(event) {
        let clickedObject = event.target; // A pin or a pin popup close button
        let selectedPoint = this.closestElementByClass(clickedObject, 'cd-single-point');

        if (!this.isWaitingForPin) {
            this.togglePinTooltipOutInWYSIWYGMode(selectedPoint);
            return;
        }

        let parentPinnableImgRow = this.closestElementByClass(clickedObject, 'pinnable-image-row');
        if (parentPinnableImgRow) {
            this.hideMeditorTooltip(parentPinnableImgRow);
        }

        // Remove saved pin in edit
        if (!this.isSavedPin(selectedPoint)
            && this.isUpdatedPin(selectedPoint)
            && this.elementHasClass(clickedObject, 'remove-saved-pin')
        ) {
            this.removeSavedPin(selectedPoint);
            return;
        } else if (clickedObject.tagName != "BUTTON" && this.isSavedPin(selectedPoint)) { // Edit pin
            this.editPin(selectedPoint);
            return;
        }

        if (this.elementHasClass(selectedPoint, 'is-open')) {
            this.closePinTooltip(selectedPoint);
            this.removeUnsavedPin(selectedPoint);
        } else {
            this.closeLastOpenedPinTooltip();
            this.openPinTooltip(selectedPoint);
            this.setPinTooltipDirection(clickedObject);
        }

        // this.refreshMediumEditor(); // TODO ???
    }

    /**
     * Toggle (saved) pin tooltip in WYSIWYG mode
     *
     * @param event Pin icon click event
     * @param selectedPoint The pin
     */
    togglePinTooltipOutInWYSIWYGMode(selectedPoint) {
        if (this.elementHasClass(selectedPoint, 'is-open')) {
            this.hideSavedPin(selectedPoint);
            return;
        } else {
            this.showSavedPin(selectedPoint);
            return;
        }
    }

    /**
     * Toggle (saved) pin tooltip in WYSIWYG mode by pin list row
     *
     * @param event The row click event
     */
    togglePinTooltipOutInWYSIWYGModeByRow(event) {
        if (this.isWaitingForPin) {
            return;
        }

        let selectedPoint = this.getPinByRowClick(event);
        if (selectedPoint) {
            this.togglePinTooltipOutInWYSIWYGMode(selectedPoint);
        }
    }

    /**
     * Calculate new pin position in the image
     *
     * @param event Click event in the image
     * @param postImage The image
     * @returns {{x: number, y: number}} The new pin position (percent) in the image
     */
    calculateNewPinPosition(event, postImage) {
        let xCord = event.offsetX;
        let yCord = event.offsetY;
        let xPercent = xCord / postImage.width * 100;
        let yPercent = yCord / postImage.height * 100;

        return {
            'x': xPercent,
            'y': yPercent
        }
    }

    validatePinDetails(targetElement) {
        let isProductValid = false;
        let isStoreValid = false;
        let isTagsValid = false;
        let isUrlValid = false;

        let parentForm = this.closestElementByClass(targetElement, 'add-pin-form');

        let product = parentForm.querySelector('.product');
        if (product) {
            isProductValid = this.validateProduct(product, parentForm);
        }

        let store = parentForm.querySelector('.store');
        if (store) {
            isStoreValid = this.validateStore(store, parentForm);
        }

        let tags = parentForm.querySelector('.tags');
        if (tags) {
            isTagsValid = this.validateTags(tags, parentForm);
        }

        let url = parentForm.querySelector('.link');
        if (url) {
            isUrlValid = this.validateUrl(url, parentForm);
        }

        let saveButton = parentForm.querySelector('#' + parentForm.getAttribute('id') + 'Save');
        if (isProductValid && isStoreValid && isTagsValid && isUrlValid) {
            if (this.elementHasAttribute(saveButton, 'disabled')) {
                saveButton.removeAttribute('disabled');
            }
        } else {
            saveButton.setAttribute('disabled', true);
        }
    }

    validateProduct(targetElement, parentForm) {
        let validationError = parentForm.querySelector('#' + parentForm.getAttribute('id') + 'ProductValid');
        if (targetElement.value === '' || targetElement.value.length > 30) {
            validationError.classList.add('active');
            return false;
        }

        if (this.elementHasClass(validationError, 'active')) {
            validationError.classList.remove('active');
        }

        return true;
    }

    validateStore(targetElement, parentForm) {
        let validationError = parentForm.querySelector('#' + parentForm.getAttribute('id') + 'StoreValid');
        if (targetElement.value.length > 25) {
            validationError.classList.add('active');
            return false;
        }

        if (this.elementHasClass(validationError, 'active')) {
            validationError.classList.remove('active');
        }

        return true;
    }

    validateTags(targetElement, parentForm) {
        let wordsArray = targetElement.value.match(/\S+/g) || [];
        let validationError = parentForm.querySelector('#' + parentForm.getAttribute('id') + 'TagsValid');

        if (wordsArray.length == 0) {
            if (this.elementHasClass(validationError, 'active')) {
                validationError.classList.remove('active');
            }
            return true;
        } else if (wordsArray.length > 10) {
            validationError.classList.add('active');
            return false;
        }

        for (let i = 0; i < wordsArray.length; i++) {
            if (wordsArray[i].length > 45) {
                validationError.classList.add('active');
                return false;
            }
        }

        if (this.elementHasClass(validationError, 'active')) {
            validationError.classList.remove('active');
        }

        return true;
    }

    isUrlValid(url) {
        return /^(http|https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(url);
    }

    validateUrl(targetElement, parentForm) {
        let validationError = parentForm.querySelector('#' + parentForm.getAttribute('id') + 'LinkValid');
        if (targetElement.value !== '' && !this.isUrlValid(targetElement.value)) {
            validationError.classList.add('active');
            return false;
        }

        if (this.elementHasClass(validationError, 'active')) {
            validationError.classList.remove('active');
        }

        return true;
    }

    /**
     * Create pin form
     *
     * @param pinId The pin ID
     * @param savedData The saved data if the pin is a saved pin
     * @returns {string} pin form
     */
    createPinForm(pinId, savedData: any = false) {
        let saveButton = '<button id="' + pinId + 'FormSave" dynamicClick="savePin()" class="btn btn-xs btn-inline btn-blue pull-right not-close-pin-mode" disabled>Pin it</button>';
        let discardButton = '<button dynamicClick="togglePinTooltip()" class="cd-close-info-button btn btn-xs btn-inline btn-gray not-close-pin-mode">Discard</button>';
        let deleteButton = '';
        let updateClass = '';
        let dataAttribute = '';
        let product = '', store = '', tags = '', link = '';

        if (savedData !== false) {
            saveButton = '<button id="' + pinId + 'FormSave" dynamicClick="savePin()" class="btn btn-xs btn-inline btn-blue pull-right not-close-pin-mode">Update</button>';
            discardButton = '<button dynamicClick="togglePinTooltip()" class="cd-close-info-button btn btn-xs btn-inline btn-gray not-close-pin-mode">Cancel</button>';
            deleteButton = '<button dynamicClick="togglePinTooltip()" class="cd-close-info-button btn btn-xs btn-inline btn-gray remove-saved-pin not-close-pin-mode">Delete</button>';
            updateClass = 'saved-pin-update';
            dataAttribute = 'data-product="' + savedData['product']
                + '" data-store="' + savedData['store']
                + '" data-tags="' + savedData['tags']
                + '" data-link="' + savedData['link'] + '"';
            product = savedData['product'];
            store = savedData['store'];
            tags = savedData['tags'];
            link = savedData['link'];
        }

        let pinDataForm = '<div id="' + pinId + 'Form" data-pin-id="' + pinId + '" class="add-pin-form form-group clearfix ' + updateClass + '" ' + dataAttribute + '>'
            + '<div class="pin-block">'
            +   '<a><i class="icn icn-add_pin"></i></a>'
            +   '<span>Pin <strong>details:</strong></span>'
            + '</div>'
            + '<input contenteditable="true" type="text" class="col-sm-12 product" placeholder="Product name" value="' + product + '"/>'
            + '<div id="' + pinId + 'FormProductValid" class="validation-error-msg add-pin-form-valid">Product is empty or name is too long, max. 30 character allowed!</div>'
            + '<input contenteditable="true" type="text" class="col-sm-12 store" placeholder="Store name" value="' + store + '"/>'
            + '<div id="' + pinId + 'FormStoreValid" class="validation-error-msg add-pin-form-valid">Store name is too long, max. 25 character allowed!</div>'
            + '<input contenteditable="true" type="text" class="col-sm-12 tags" placeholder="#Tags" value="' + tags + '"/>'
            + '<div id="' + pinId + 'FormTagsValid" class="validation-error-msg add-pin-form-valid">Too many tags or too long tags, max. 10 tags or 45 characters limitation per tag allowed!</div>'
            + '<input contenteditable="true" type="text" class="col-sm-12 link" placeholder="Link" value="' + link + '"/>'
            + '<div id="' + pinId + 'FormLinkValid" class="validation-error-msg add-pin-form-valid">Not valid url!</div>'
            + discardButton
            + deleteButton
            + saveButton
            + '</div>';

        return pinDataForm;
    }

    /**
     * Create a new pin html
     *
     * @param position The new pin position
     * @param spId The new pin ID
     * @returns {string} The new pin html
     */
    createNewPin(position, pinId) {
        return '<li id="' + pinId + '" class="cd-single-point" style="top:' + position.y + '%; left: ' + position.x + '%">'
            + '<i class="icn icn-add_pin" dynamicClick="togglePinTooltip()" dynamicMouseOut="hideSavedPin()" dynamicMouseOver="showSavedPin()"></i>'
            + '<a class="cd-img-replace" href="javascript:void(0);" dynamicClick="togglePinTooltip()" dynamicMouseOut="hideSavedPin()" dynamicMouseOver="showSavedPin()" data-disable-preview="true">Pin</a>'
            + '<div class="cd-more-info">'
            + this.createPinForm(pinId)
            // + '<a href="javascript:void();" data-disable-preview="true" class="cd-close-info cd-img-replace"><i class="icn icn-cross"></i></a>'
            + '</div>'
            + '</li>';
    }

    /**
     * Add new pin to the image
     *
     * @param event Click event in an image
     */
    addNewPin(event) {
        var postImage = event.target;
        if (!this.elementHasClass(postImage, 'post-image')) {
            return false;
        }

        let parentPinnableImgRow = this.closestElementByClass(postImage, 'pinnable-image-row');
        if (!parentPinnableImgRow) {
            return;
        }

        let imageOptionMenu = parentPinnableImgRow.querySelector('.post-image-options');
        if (!this.isWaitingForPin || imageOptionMenu.getAttribute("id") !== this.lastShowedImageOptionMenuId) {
            return;
        }

        this.hideMeditorTooltip(parentPinnableImgRow);
        this.removeLastOpenedUnsavedPin();
        let position = this.calculateNewPinPosition(event, postImage);

        let postImageId = postImage.getAttribute("id");
        let pinId = postImageId + 'SP' + Math.floor(position.y) + '' + Math.floor(position.x);
        let newPin = this.createNewPin(position, pinId);

        let pinList = this.elementRef.nativeElement.querySelector('#' + postImageId + 'Ul');
        pinList.insertAdjacentHTML('beforeend', newPin);
        // this.refreshMediumEditor(); // TODO ???

        // setTimeout(() => {
        let selectedPoint = this.elementRef.nativeElement.querySelector('#' + pinId);
        let selectedPointA = this.elementRef.nativeElement.querySelector('#' + pinId + ' a');
        this.openPinTooltip(selectedPoint);
        this.setPinTooltipDirection(selectedPointA);
        // }, 0);

    }

    /**
     * Remove unsaved pin
     */
    removeUnsavedPin(selectedPoint) {
        if (this.isSavedPin(selectedPoint)) {
            return;
        } else if (this.isUpdatedPin(selectedPoint)) {
            this.closePinEditor(selectedPoint);
            return;
        }
        selectedPoint.parentNode.removeChild(selectedPoint);
        // this.refreshMediumEditor(); // TODO ??
    }

    /**
     * Remove last opened pin if that is unsaved
     */
    removeLastOpenedUnsavedPin() {
        if (!this.lastOpenedPin === null || !this.elementExist('#' + this.lastOpenedPin)) {
            return;
        }
        let lastOpenedPinElement = this.elementRef.nativeElement.querySelector('#' + this.lastOpenedPin);
        this.closeLastOpenedPinTooltip();
        this.removeUnsavedPin(lastOpenedPinElement);
        this.lastOpenedPin = null;
        this.lastOpenedPinChanged();
    }

    /**
     * Create a span with a pin data
     *
     * @param pinForm The pin data container element
     * @returns {string} created span
     */
    createSavedPinData(pinForm) {
        let product = pinForm.querySelector('.product');
        let store = pinForm.querySelector('.store');
        let tags = pinForm.querySelector('.tags');
        let link = pinForm.querySelector('.link');

        let storeLink = '';
        if (link.value && (link.value.startsWith("http://") || link.value.startsWith("https://"))) {
            storeLink = '<i class="icn icn-basket"></i><a href="' + link.value + '" data-disable-preview="true" target="_blank">Go to store</a>';
        } else if (link.value) {
            storeLink = '<i class="icn icn-basket"></i><a href="http://' + link.value + '" data-disable-preview="true" target="_blank">Go to store</a>';
        }

        let response = '<span data-pin-id="' + pinForm.getAttribute("data-pin-id") + '" class="saved-pin-data" data-product="' + product.value + '" data-store="'
            + store.value + '" data-tags="' + tags.value + '" data-link="' + link.value + '">'
            + '<p><strong>Product name: </strong>' + product.value + '</p>'
            + '<p><strong>Store name: </strong>' + store.value + '</p>'
            + storeLink
            + '</span>';
        return response;
    }

    /**
     * Crate a row to the pin row list a pin data
     *
     * @param selectedPointId The pin id
     * @param pinForm The pin data container element
     * @returns {string} created row
     */
    createSavedPinRow(selectedPointId, formData) {
        let storeLink = '';
        if (formData.link.value && (formData.link.value.startsWith("http://") || formData.link.value.startsWith("https://"))) {
            storeLink = '<a href="' + formData.link.value + '" data-disable-preview="true" class="pin-rows-go-to-store" target="_blank"><i class="go-to-store-edit icn icn-basket"></i></a>';
        } else if (formData.link.value) {
            storeLink = '<a href="http://' + formData.link.value + '" data-disable-preview="true" class="pin-rows-go-to-store" target="_blank"><i class="go-to-store-edit icn icn-basket"></i></a>';
        }

        return '<li id="' + selectedPointId + 'Row" data-rel="' + selectedPointId + '" class="pin-row-list-element">'
            + '<a class="add-pin" href="javascript:void(0);"><i class="icn icn-add_pin"></i></a>'
            + '<strong>' + formData.product.value + '</strong>- '
            + formData.store.value
            + storeLink
            + '<a href="javascript:void(0);" data-disable-preview="true" dynamicClick="removeSavedPinByRow()" class="pin-rows-edit-pin"><i dynamicClick="removeSavedPinByRow()" class="go-to-store-edit icn icn-close"></i></a>'
            + '<a href="javascript:void(0);" data-disable-preview="true" dynamicClick="editPinByRow()" class="pin-rows-edit-pin"><i dynamicClick="editPinByRow()" class="go-to-store-edit icn icn-edit_icon"></i></a>'
            + '</li>';
    }

    /**
     * Insert or change a pin data row
     *
     * @param pinForm The pin data container element
     */
    insertSavedPinRow(selectedPoint, formData, isUpdatePin) {
        let selectedPointId = selectedPoint.getAttribute("id");
        let pinImageRow = this.closestElementByClass(selectedPoint, 'pinnable-image-row');

        let pinRowList = pinImageRow.querySelector('.pin-row-list');
        let newPinRow = this.createSavedPinRow(selectedPointId, formData);
        let oldPinRow = this.elementRef.nativeElement.querySelector('#' + selectedPointId + 'Row');

        if (isUpdatePin && oldPinRow) {
            oldPinRow.insertAdjacentHTML('afterend', newPinRow);
            oldPinRow.remove();
            return;
        }
        pinRowList.insertAdjacentHTML('beforeend', newPinRow);
    }

    /**
     * Save a pin data
     *
     * @param event savePin click event
     * return {void}
     */
    savePin(pinForm) {
        let selectedPoint = this.closestElementByClass(pinForm, 'cd-single-point');
        if (!pinForm || !selectedPoint) {
            return;
        }

        let parentPinnableImgRow = this.closestElementByClass(pinForm, 'pinnable-image-row');
        if (parentPinnableImgRow) {
            this.hideMeditorTooltip(parentPinnableImgRow);
        }

        let savedPinData = this.createSavedPinData(pinForm);
        let pinFormParent = pinForm.parentNode;

        let isUpdatePin = this.isUpdatedPin(selectedPoint);
        let formData = {
            'product': pinForm.querySelector('.product'),
            'store': pinForm.querySelector('.store'),
            'tags': pinForm.querySelector('.tags'),
            'link': pinForm.querySelector('.link')
        };

        pinFormParent.removeChild(pinForm);
        pinFormParent.insertAdjacentHTML('afterbegin', savedPinData);

        // setTimeout(() => {
        this.insertSavedPinRow(selectedPoint, formData, isUpdatePin);
        // this.refreshMediumEditor(); // TODO ???
        // }, 0);
    }

    /**
     * Check the pin is saved
     *
     * @param selectedPoint Actual pin
     * @returns {boolean} true if the actual pin is saved
     */
    isSavedPin(selectedPoint) {
        if (!selectedPoint) {
            return false;
        }
        let savedData = selectedPoint.querySelector('.saved-pin-data');
        if (savedData && savedData.tagName === "SPAN") {
            return true;
        }
        return false;
    }

    /**
     * Show saved pin tooltip menu
     *
     * @param selectedPoint the pin
     */
    showSavedPin(target) {
        let selectedPoint;
        let selectedPointA;
        if (!this.elementHasClass(target, 'cd-single-point')) {
            selectedPointA = target;
            selectedPoint = this.closestElementByClass(selectedPointA, 'cd-single-point');
        } else {
            selectedPoint = target;
            selectedPointA = this.elementRef.nativeElement.querySelector('#' + selectedPoint.getAttribute('id') + ' a');
        }

        if (!this.isSavedPin(selectedPoint)) {
            return;
        }

        this.removeLastOpenedUnsavedPin();
        this.openPinTooltip(selectedPoint);
        this.setPinTooltipDirection(selectedPointA);
    }

    /**
     * Hide saved pin tooltip menu
     *
     * @param selectedPoint the pin
     */
    hideSavedPin(target) {
        let selectedPoint;
        if (!this.elementHasClass(target, 'cd-single-point')) {
            selectedPoint = this.closestElementByClass(target, 'cd-single-point');
        } else {
            selectedPoint = target;
        }

        if (!this.isSavedPin(selectedPoint)) {
            return;
        }

        this.closePinTooltip(selectedPoint);
    }

    /**
     * Return selectedPoint (pin) by row click event
     *
     * @param event Row click event
     * @returns {Element|HTMLElement|any} selectedPoint or false
     */
    getPinByRowClick(event) {
        let targetElement = event.target;

        if (!this.elementHasClass(targetElement, 'pin-row-list-element')) {
            targetElement = this.closestElementByClass(targetElement, 'pin-row-list-element');
        }

        let selectedPoint = this.elementRef.nativeElement.querySelector('#' + targetElement.getAttribute("data-rel"));
        if (!selectedPoint) {
            return false;
        }

        return selectedPoint;
    }

    /**
     * Edit saved pin data by row click event
     *
     * @param event Edit button click event
     */
    editPinByRow(event) {
        if (!this.isWaitingForPin) {
            return;
        }

        let parentPinnableImgRow = this.closestElementByClass(event.target, 'pinnable-image-row');
        if (parentPinnableImgRow) {
            this.hideMeditorTooltip(parentPinnableImgRow);
        }

        let selectedPoint = this.getPinByRowClick(event);
        if (selectedPoint) {
            this.editPin(selectedPoint);
        }
    }

    /**
     * Edit saved pon data
     *
     * @param selectedPoint The pin
     */
    editPin(selectedPoint) {
        if (!this.isWaitingForPin) {
            return;
        }

        let savedPinData = selectedPoint.querySelector('.saved-pin-data');
        if (!savedPinData) {
            return;
        }

        this.removeLastOpenedUnsavedPin();

        let savedData = {
            'product': savedPinData.getAttribute('data-product'),
            'store': savedPinData.getAttribute('data-store'),
            'tags': savedPinData.getAttribute('data-tags'),
            'link': savedPinData.getAttribute('data-link')
        };

        let updateForm = this.createPinForm(savedPinData.getAttribute("data-pin-id"), savedData);

        let savedPinParent = savedPinData.parentNode;
        savedPinData.remove();
        savedPinParent.insertAdjacentHTML('afterbegin', updateForm);

        this.openPinTooltip(selectedPoint);

        // this.refreshMediumEditor(); // TODO
    }

    /**
     * Decide from a pin form, that is an update form or not
     *
     * @param selectedPoint A pin
     * @returns {boolean} true if this form is an update form otherwise false
     */
    isUpdatedPin(selectedPoint) {
        if (!selectedPoint) {
            return false;
        }

        if (this.elementExist('.saved-pin-update', selectedPoint)) {
            return true;
        }

        return false;
    }

    /**
     * Close pin editor without save
     *
     * @param updatePinForm The pin update form
     */
    closePinEditor(selectedPoint) {
        let updatePinForm = selectedPoint.querySelector('.saved-pin-update');
        updatePinForm.querySelector('.product').value = updatePinForm.getAttribute('data-product');
        updatePinForm.querySelector('.store').value = updatePinForm.getAttribute('data-store');
        updatePinForm.querySelector('.tags').value = updatePinForm.getAttribute('data-tags');
        updatePinForm.querySelector('.link').value = updatePinForm.getAttribute('data-link');

        this.savePin(updatePinForm);
    }

    /**
     * Remove saved pin
     *
     * @param selectedPoint The removable pin
     */
    removeSavedPin(selectedPoint) {
        if (!this.isWaitingForPin) {
            return;
        }

        let selectedRow = this.elementRef.nativeElement.querySelector('#' + selectedPoint.getAttribute('id') + 'Row');
        if (selectedRow) {
            selectedRow.parentNode.removeChild(selectedRow);
        }
        selectedPoint.parentNode.removeChild(selectedPoint);

        // this.refreshMediumEditor(); // TODO ???

        if (this.lastOpenedPin = selectedPoint.getAttribute('id')) {
            this.lastOpenedPin = null;
            this.lastOpenedPinChanged();
        }
    }

    /**
     * Remove saved pin by row click event
     *
     * @param event Remove button click event
     */
    removeSavedPinByRow(event) {
        if (!this.isWaitingForPin) {
            return;
        }

        let parentPinnableImgRow = this.closestElementByClass(event.target, 'pinnable-image-row');
        if (parentPinnableImgRow) {
            this.hideMeditorTooltip(parentPinnableImgRow);
        }

        let selectedPoint = this.getPinByRowClick(event);
        if (selectedPoint) {
            this.removeSavedPin(selectedPoint);
        }
    }

    /* Edit \ Create pin end */

    /* Clipboard data cleaning start */

    getClipboardContent(event) {
        let dataTransfer = event.clipboardData || (<any>window).clipboardData || (<any>document).dataTransfer,
            data = {};

        if (!dataTransfer) {
            return data;
        }

        // Use old WebKit/IE API
        if (dataTransfer.getData) {
            let legacyText = dataTransfer.getData('Text');
            if (legacyText && legacyText.length > 0) {
                data['text/plain'] = legacyText;
            }
        }

        if (dataTransfer.types) {
            for (let i = 0; i < dataTransfer.types.length; i++) {
                let contentType = dataTransfer.types[i];
                data[contentType] = dataTransfer.getData(contentType);
            }
        }

        return data;
    }

    changeImageSrc(images) {
        for(var i=0; i < images.length; i++){
            let btoaHash = btoa(images[i].src);
            let newUrl = this.thumbImageUrl + btoaHash;
            //resized_height, resized_width

            let tmpId = 'tmp' + this.imageCounter;
            images[i].outerHTML = this.generateImageContainer({
                'src': newUrl,
                'id': tmpId
            });

            this.imageCounter++;
            this.uploadImageByUrl(newUrl, tmpId);
        }
    }

    uploadImageByUrl(url, id) {
        this.pasteImageEvent.emit({'url': url, 'id': id});
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

    cleanupTags(element) {
        if (this.cleanTags.indexOf(element.nodeName.toLowerCase()) !== -1) {
            if (element.nodeName.toLowerCase() === 'a' && element.querySelector('img')) {
                let image = element.querySelector('img');
                element.parentNode.insertBefore(image, element);
                element.parentNode.removeChild(element);
            } else if (element.nodeName.toLowerCase() === 'a') {
                let replacementNode = document.createElement('a');
                replacementNode.setAttribute('href', element.getAttribute('href'));
                replacementNode.setAttribute('target', '_blank');
                //let replacementNode = document.createElement('p');
                replacementNode.innerHTML = element.textContent;
                element.parentNode.insertBefore(replacementNode, element);
                element.parentNode.removeChild(element);
            } else {
                element.parentNode.removeChild(element);
            }
        }
    }

    unwrap(element) {
        if (this.unwrapTags.indexOf(element.nodeName.toLowerCase()) !== -1) {
            var fragment = document.createDocumentFragment(),
                nodes = Array.prototype.slice.call(element.childNodes);

            // cast nodeList to array since appending child
            // to a different node will alter length of el.childNodes
            for (var i = 0; i < nodes.length; i++) {
                fragment.appendChild(nodes[i]);
            }

            if (fragment.childNodes.length) {
                element.parentNode.replaceChild(fragment, element);
            } else {
                element.parentNode.removeChild(element);
            }
        }
    }

    isAnYoutubeUrl(text) {
        let YOUTUBE_REGEXP =
            /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be|y2u\.be)\/watch\?v=([^&]+)$/i;

        if (YOUTUBE_REGEXP.test(text)) {
            return true;
        } else {
            return false;
        }
    }

    /* Clipboard data cleaning end */

    /* Utils method start */

    removePlaceholder() {
        if (this.editor.elements[0].innerHTML !== '' && this.elementHasClass(this.editor.elements[0], 'medium-editor-placeholder')) {
            this.editor.elements[0].classList.remove('medium-editor-placeholder');
        }
    }

    /**
     * Check an element has a classList
     *
     * @param element actual element
     * @returns {boolean} True if the actual element has a classList otherwise false
     */
    elementHasClassList(element) {
        if (element && element.classList) {
            return true;
        }
        return false;
    }

    /**
     * Check an element has a specific class
     *
     * @param element actual element
     * @param className specific class
     * @returns {boolean} True if the actual element has a specific class otherwise false
     */
    elementHasClass(element, className) {
        if (this.elementHasClassList(element) && element.classList.contains(className)) {
            return true;
        }
        return false;
    }

    /**
     * Check an element has a specific attribute
     *
     * @param element actual element
     * @param attribute specific attribute
     * @returns {boolean} True if the actual element ha a specific attribute otherwise false
     */
    elementHasAttribute(element, attribute) {
        if (element.getAttribute && element.getAttribute(attribute) !== undefined) {
            return true;
        }
        return false;
    }

    /**
     * Check an element is exist
     *
     * @param selector the element (css) selector
     * @param parentElement parent element
     * @returns {boolean} True if the element is exist otherwise false
     */
    elementExist(selector, parentElement = null) {
        let element = false;
        if (parentElement !== null) {
            element = parentElement.querySelector(selector);
        } else {
            element = this.elementRef.nativeElement.querySelector(selector);
        }

        if (element) {
            return true;
        }
        return false;
    }

    /**
     * Return actual element closest element by tagName if that is exist
     *
     * @param element
     * @param tagname
     * @returns {any}
     */
    closestElementByTagname(element, tagname) {
        while (element && element.parentNode) {
            let parent = element.parentNode;
            if (parent && parent.tagName === tagname) {
                return parent;
            }
            element = parent;
        }
        return false;
    }

    /**
     * Return actual element closest element by class if that is exist
     *
     * @param element Actual element
     * @param selector Class selector
     * @returns {any} Closest element if that is exist or false
     */
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
    /* Utils method end */

    // PasteBinDemo

    lastRange: any;
    pasteBinDefaultContent = '%ME_PASTEBIN%';
    pasteBinId;
    stopProp = function (event) {
        event.stopPropagation();
    };

    createPasteBin(editable, event) {
        let rects,
            range = this.getSelectionRange(),
            top = window.pageYOffset;

        if (range) {
            rects = range.getClientRects();

            // on empty line, rects is empty so we grab information from the first container of the range
            if (rects.length) {
                top += rects[0].top;
            } else {
                top += (<Element>range.startContainer).getBoundingClientRect().top;
            }
        }

        this.lastRange = range;

        let pasteBinElm = document.createElement('div');
        pasteBinElm.id = this.pasteBinId = 'medium-editor-pastebin-' + (+Date.now());
        pasteBinElm.setAttribute('style', 'border: 1px red solid; position: absolute; top: ' + top + 'px; width: 10px; height: 10px; overflow: hidden; opacity: 0');
        pasteBinElm.setAttribute('contentEditable', 'true');
        pasteBinElm.innerHTML = this.pasteBinDefaultContent;

        document.body.appendChild(pasteBinElm);

        // avoid .focus() to stop other event (actually the paste event)
        this.editor.on(pasteBinElm, 'focus', this.stopProp);
        this.editor.on(pasteBinElm, 'focusin', this.stopProp);
        this.editor.on(pasteBinElm, 'focusout', this.stopProp);

        pasteBinElm.focus();

        this.selectNode(pasteBinElm);

        this.handlePasteBinPaste(editable, event);

        let mediumInsertActives = document.querySelectorAll('.medium-insert-active');
        if (mediumInsertActives) {
            for (let i = 0; i < mediumInsertActives.length; i++) {
                mediumInsertActives[i].classList.remove('medium-insert-active');
            }
        }
    }

    handlePasteBinPaste(editable, event) {
        if (event.defaultPrevented) {
            this.removePasteBin();
            return;
        }

        let clipboardContent = this.getClipboardContent(event),
            pastedHTML = clipboardContent['text/html'],
            pastedPlain = clipboardContent['text/plain'];

        // If we have valid html already, or we're not in cleanPastedHTML mode
        // we can ignore the paste bin and just paste now
        if (pastedHTML) {
            event.preventDefault();
            this.removePasteBin();
            this.doPaste(pastedHTML, pastedPlain, editable);

            // The event handling code listens for paste on the editable element
            // in order to trigger the editablePaste event.  Since this paste event
            // is happening on the pastebin, the event handling code never knows about it
            // So, we have to trigger editablePaste manually
            this.editor.trigger('editablePaste', { currentTarget: editable, target: editable }, editable);
            return;
        }

        // We need to look at the paste bin, so do a setTimeout to let the paste
        // fall through into the paste bin
        setTimeout(function () {
            // Only look for HTML if we're in cleanPastedHTML mode
            if (this.cleanPastedHTML) {
                // If clipboard didn't have HTML, try the paste bin
                pastedHTML = this.getPasteBinHtml();
            }

            // If we needed the paste bin, we're done with it now, remove it
            this.removePasteBin();

            // Handle the paste with the html from the paste bin
            this.doPaste(pastedHTML, pastedPlain, editable);

            // The event handling code listens for paste on the editable element
            // in order to trigger the editablePaste event.  Since this paste event
            // is happening on the pastebin, the event handling code never knows about it
            // So, we have to trigger editablePaste manually
            this.editor.trigger('editablePaste', { currentTarget: editable, target: editable }, editable);
        }.bind(this), 0);
    }

    removePasteBin() {
        if (null !== this.lastRange) {
            this.selectRange(this.lastRange);
            this.lastRange = null;
        }

        let pasteBinElm = this.getPasteBin();
        if (!pasteBinElm) {
            return;
        }

        if (pasteBinElm) {
            this.editor.off(pasteBinElm, 'focus', this.stopProp);
            this.editor.off(pasteBinElm, 'focusin', this.stopProp);
            this.editor.off(pasteBinElm, 'focusout', this.stopProp);
            pasteBinElm.parentElement.removeChild(pasteBinElm);
        }
    }

    doPaste(pastedHTML, pastedPlain, editable) {
        var paragraphs,
            html = '',
            p;

        let elem = document.createElement("p");
        elem.innerHTML = pastedHTML;

        if (elem) {
            if (//this.elementHasClass(event.target, 'img-caption') ||
                this.elementHasClass(event.target, 'pinnable-image-row')
                || this.closestElementByClass(event.target, 'pinnable-image-row')
            ) {
                return;
            }

            // event.preventDefault(); TODO lehet kell

            let allElements = elem.querySelectorAll('*');
            for (let i = 0; i < allElements.length; i += 1) {
                let workEl = allElements[i];

                if ('a' === workEl.nodeName.toLowerCase()) {
                    workEl.setAttribute('target', '_blank');
                }

                this.cleanupAttrs(workEl);
                this.cleanupTags(workEl);
                this.unwrap(workEl);
            }

            this.changeImageSrc(elem.getElementsByTagName('img'));

            // if (event.target.classList && event.target.classList.contains('medium-editor-element')) {
            //   event.target.appendChild(elem);
            // } else {
            //   event.target.insertAdjacentHTML('afterend', elem.outerHTML);
            // }
        // } else if (this.elementHasClass(event.target, 'img-caption')) {
        //     this.setImageCaptionData(event.target.getAttribute('data-image-id'), event.target.textContent.trim());
        } else if (!elem && pastedPlain) {
            if (this.isAnYoutubeUrl(pastedPlain)) {
                // event.preventDefault();
                this.pasteEmbedMediaEvent.emit({'event': event, 'data': pastedPlain});
                return;
            }
        }

        // html = MediumEditor.util.htmlEntities(pastedPlain);

        this.removePlaceholder();

        this.insertHTMLCommand(elem);
    }

    selectNode(node) {
        let range = document.createRange();
        range.selectNodeContents(node);
        this.selectRange(range);
    }

    selectRange(range) {
        let selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    getSelectionRange() {
        var selection = document.getSelection();
        if (selection.rangeCount === 0) {
            return null;
        }
        return selection.getRangeAt(0);
    }

    getPasteBin() {
        return document.getElementById(this.pasteBinId);
    }

    getPasteBinHtml() {
        var pasteBinElm = this.getPasteBin();

        if (!pasteBinElm) {
          return false;
        }

        // WebKit has a nice bug where it clones the paste bin if you paste from for example notepad
        // so we need to force plain text mode in this case
        if (pasteBinElm.firstChild && (<Element>pasteBinElm.firstChild).id === 'mcepastebin') {
            return false;
        }

        var pasteBinHtml = pasteBinElm.innerHTML;

        // If paste bin is empty try using plain text mode
        // since that is better than nothing right
        if (!pasteBinHtml || pasteBinHtml === this.pasteBinDefaultContent) {
            return false;
        }

        return pasteBinHtml;
    }

    insertHTMLCommand(html) {
        var selection, range, el, fragment, node, lastNode, toReplace,
            res = false,
            ecArgs = ['insertHTML', false, html.innerHTML];

        /* Edge's implementation of insertHTML is just buggy right now:
         * - Doesn't allow leading white space at the beginning of an element
         * - Found a case when a <font size="2"> tag was inserted when calling alignCenter inside a blockquote
         *
         * There are likely other bugs, these are just the ones we found so far.
         * For now, let's just use the same fallback we did for IE
         */
        if (!((/Edge\/\d+/).exec(navigator.userAgent) !== null) && document.queryCommandSupported('insertHTML')) {
            try {
                return document.execCommand.apply(document, ecArgs);
            } catch (ignore) {}
        }

        selection = document.getSelection();
        if (selection.rangeCount) {
            range = selection.getRangeAt(0);
            toReplace = range.commonAncestorContainer;

            // https://github.com/yabwe/medium-editor/issues/748
            // If the selection is an empty editor element, create a temporary text node inside of the editor
            // and select it so that we don't delete the editor element
            if (this.isMediumEditorElement(toReplace) && !toReplace.firstChild) {
                range.selectNode(toReplace.appendChild(document.createTextNode('')));
            } else if ((toReplace.nodeType === 3 && range.startOffset === 0 && range.endOffset === toReplace.nodeValue.length) ||
                (toReplace.nodeType !== 3 && toReplace.innerHTML === range.toString())
            ) {
                // Ensure range covers maximum amount of nodes as possible
                // By moving up the DOM and selecting ancestors whose only child is the range
                while (!this.isMediumEditorElement(toReplace) &&
                toReplace.parentNode &&
                toReplace.parentNode.childNodes.length === 1 &&
                !this.isMediumEditorElement(toReplace.parentNode)) {
                    toReplace = toReplace.parentNode;
                }
                range.selectNode(toReplace);
            }
            range.deleteContents();

            el = document.createElement('div');
            el.innerHTML = html.innerHTML;
            fragment = document.createDocumentFragment();
            while (el.firstChild) {
                node = el.firstChild;
                lastNode = fragment.appendChild(node);
            }
            range.insertNode(fragment);

            // Preserve the selection:
            if (lastNode) {
                range = range.cloneRange();
                range.setStartAfter(lastNode);
                range.collapse(true);
                this.selectRange(range)
            }
            res = true;
        }

        // https://github.com/yabwe/medium-editor/issues/992
        // If we're monitoring calls to execCommand, notify listeners as if a real call had happened
        // if ((<any>document).execCommand.callListeners) {
        //     (<any>document).execCommand.callListeners(ecArgs, res);
        // }
        return res;
    }

    isMediumEditorElement(element) {
        return element && element.getAttribute && !!element.getAttribute('data-medium-editor-element');
    }

    // PasteBinDemoEnd

}
