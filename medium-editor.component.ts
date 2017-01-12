import { Component, Input, forwardRef, ElementRef, ViewChild, OnChanges, OnInit, OnDestroy, ViewEncapsulation, Output, EventEmitter } from '@angular/core';
import * as MediumEditor from './src/MediumEditor/js/medium-editor';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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
    @Output() focusEvent = new EventEmitter<any>();
    @Output() keyUpEvent = new EventEmitter<any>();
    @Output() clickEvent = new EventEmitter<any>();

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
        this.editor.subscribe('editableInput', (event: any, editable: any) => {
            let value = this.editor.elements[0].innerHTML;
            this.ngOnChanges(value);
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
