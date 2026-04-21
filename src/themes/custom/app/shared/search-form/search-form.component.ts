import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NgbDatepicker,
  NgbDatepickerModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';

import { SearchFormComponent as BaseComponent } from '../../../../../app/shared/search-form/search-form.component';
import { BrowserOnlyPipe } from '../../../../../app/shared/utils/browser-only.pipe';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'ds-themed-search-form',
  // styleUrls: ['./search-form.component.scss'],
  styleUrls: [
    '../../../../../app/shared/search-form/search-form.component.scss',
  ],
  // templateUrl: './search-form.component.html',
  templateUrl:
    '../../../../../app/shared/search-form/search-form.component.html',
  imports: [
    AsyncPipe,
    BrowserOnlyPipe,
    FormsModule,
    NgbTooltipModule,
    TranslateModule,
    ButtonModule,
    PopoverModule,
    NgbDatepickerModule,
    DatePickerModule,
    JsonPipe,
  ],
})
export class SearchFormComponent extends BaseComponent {}
