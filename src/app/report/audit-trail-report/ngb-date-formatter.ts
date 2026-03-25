// ngb-date-ddmmyyyy-formatter.ts
import { Injectable } from '@angular/core';
import {
  NgbDateParserFormatter,
  NgbDateStruct,
} from '@ng-bootstrap/ng-bootstrap';

/**
 * Formats datepicker input as "dd-MM-yyyy" for display and parsing.
 * Internally the model stays as NgbDateStruct; you can still convert to ISO
 * for backend using your existing helper (toIsoString).
 */
@Injectable()
export class NgbDateDdMmYyyyParserFormatter extends NgbDateParserFormatter {
  // format model -> string shown in input
  format(date: NgbDateStruct | null): string {
    if (!date) return '';
    const dd = String(date.day).padStart(2, '0');
    const mm = String(date.month).padStart(2, '0');
    const yyyy = date.year;
    return `${dd}-${mm}-${yyyy}`;
  }

  // parse string from input -> NgbDateStruct
  parse(value: string): NgbDateStruct | null {
    if (!value) return null;
    const parts = value.trim().split(/[-/\.]/); // accept -, / or . as separators
    if (parts.length !== 3) return null;
    const [p1, p2, p3] = parts;
    const day = parseInt(p1, 10);
    const month = parseInt(p2, 10);
    const year = parseInt(p3, 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return { day, month, year };
  }
}
