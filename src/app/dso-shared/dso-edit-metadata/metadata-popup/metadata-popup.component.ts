import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { HumanizeSimplePipe } from 'src/app/shared/utils/humanize-simple.pipe';
import { RemovePrefixPipe } from 'src/app/shared/utils/remove-prefix.pipe';

@Component({
  standalone: true,
  selector: 'ds-metadata-popup',
  templateUrl: './metadata-popup.component.html',
  styleUrls: ['./metadata-popup.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HumanizeSimplePipe,
    RemovePrefixPipe,
  ],
})
export class MetadataPopupComponent {
  @Input() show = false;
  @Input() fieldKey = ''; // dc.Petitioner or dc.Respondent
  @Input() initial = ''; // raw string: "a;b;c"

  @Output() saved = new EventEmitter<{ fieldKey: string; values: string[] }>();
  @Output() closed = new EventEmitter<void>();

  values: string[] = [];
  editIndex = -1;
  editValue = '';

  form = new FormGroup({
    newEntry: new FormControl(''),
  });

  // metadata-popup.component.ts (inside class)
  open(opts: { fieldKey: string; initial?: string }) {
    console.log(opts);
    this.fieldKey = opts.fieldKey || '';
    this.initial = opts.initial || '';

    // initialize values array from initial string
    this.values = (this.initial || '')
      .split(';')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    // reset form state
    if (this.form && this.form.get('newEntry')) {
      this.form.get('newEntry')!.setValue('');
    }

    this.editIndex = -1;
    this.editValue = '';

    // show the modal
    this.show = true;
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('MetadataPopup ngOnChanges', changes);
    if (this.initial) {
      this.values = this.initial
        .split(';')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
  }

  add() {
    const val = this.form.get('newEntry').value.trim();
    if (!val) return;
    this.values.push(val);
    this.form.get('newEntry').setValue('');
  }

  startEdit(i: number) {
    this.editIndex = i;
    this.editValue = this.values[i];
  }

  saveEdit(i: number) {
    const v = this.editValue.trim();
    if (!v) return;
    this.values[i] = v;
    this.cancelEdit();
  }

  cancelEdit() {
    this.editIndex = -1;
    this.editValue = '';
  }

  delete(i: number) {
    this.values.splice(i, 1);
  }

  save() {
    const payload = this.values.map((v) => (v || '').trim()).filter(Boolean);
    this.saved.emit({ fieldKey: this.fieldKey, values: payload });
  }

  close() {
    this.show = false;
    this.closed.emit();
  }

  saveAndClose() {
    const payload = this.values.map((v) => (v || '').trim()).filter(Boolean);
    this.saved.emit({ fieldKey: this.fieldKey, values: payload });
    this.show = false;
    this.closed.emit();
  }
}
