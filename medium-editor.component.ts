import { Component, Input, forwardRef, ElementRef, ViewChild, OnChanges, OnInit, OnDestroy, ViewEncapsulation, Output, EventEmitter } from '@angular/core';
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
    template: `<div #host></div>`,
    styleUrls: [
        './src/MediumEditor/css/font-awesome.min.css',
        './src/MediumEditor/css/medium-editor.css',
    ]
})
export class MediumEditorComponent implements ControlValueAccessor, OnInit, OnDestroy, OnChanges {
    @Input() options: any;
    @Input() placeholder: string;
    el: ElementRef;
    editor: any;
    @ViewChild('host') host: any;
    propagateChange = (_: any) => { };

    // Triggering events
    @Output() changeEvent = new EventEmitter<any>();
    @Output() focusEvent = new EventEmitter<any>();
    @Output() keyUpEvent = new EventEmitter<any>();
    @Output() clickEvent = new EventEmitter<any>();
    @Output() blurEvent = new EventEmitter<any>();
    @Output() pasteEvent = new EventEmitter<any>();

    constructor(el: ElementRef) {
        this.el = el;
    }

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

        this.registerEventListeners();
    }

    ngOnDestroy() {
        if (this.editor) {
            this.editor.destroy();
        }
    }

    ngOnChanges(changes: any) {
        this.propagateChange(changes);
    }

    registerEventListeners() {
        this.editor.subscribe('editableInput', (data: any, element: any) => {
            let value = this.editor.elements[0].innerHTML;
            this.ngOnChanges(value);
            this.changeEvent.emit({'event': data, 'target': element});
        });
        this.editor.subscribe('focus', (data: any, element: any) => {
            this.focusEvent.emit({'event': data, 'target': element});
        });
        this.editor.subscribe('editableKeyup', (data: any, element: any) => {
            this.keyUpEvent.emit({'event': data, 'target': element});
        });
        this.editor.subscribe('editableClick', (data: any, element: any) => {
            this.clickEvent.emit({'event': data, 'target': element});
        });
        this.editor.subscribe('blur', (data: any, element: any) => {
            this.blurEvent.emit({'event': data, 'target': element});
        });
        this.editor.subscribe('editablePaste', (data: any, element: any) => {
            this.pasteEvent.emit({'event': data, 'target': element});
        });

    }

    setExtensions() {
        if (!this.options || !this.options.toolbar || !this.options.toolbar.buttons) {
            return;
        }
        for (let i = 0; i < this.options.toolbar.buttons.length; i++) {
            if (this.options.toolbar.buttons[i] === 'headingExtension' && this.options.extensions) {
                let headingExtensionService = new HeadingExtension();
                this.options.extensions['headingExtension'] = headingExtensionService.getHeadingExtension();
            } else if (this.options.toolbar.buttons[i] === 'colorPicker' && this.options.extensions) {
                let colorPickerExtensionService = new ColorPickerExtension();
                this.options.extensions['colorPicker'] = colorPickerExtensionService.getPickerExtension();
            } else if (this.options.toolbar.buttons[i] === 'cleanFormatExtension' && this.options.extensions && "cleanFormatExtension" in this.options.extensions) {
                let cleanFormatExtensionService = new CleanFormatExtension();
                cleanFormatExtensionService.setCleanupAttrs(this.options.extensions['cleanFormatExtension']);
                this.options.extensions['cleanFormatExtension'] = cleanFormatExtensionService.getCleanFormatExtension();
            } else if ((typeof this.options.toolbar.buttons[i]) == 'string' && this.options.toolbar.buttons[i].startsWith('dividerExtension') && this.options.extensions) {
                let dividerExtensionService = new DividerExtension();
                this.options.extensions[this.options.toolbar.buttons[i]] = dividerExtensionService.getDividerExtension();
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

}
