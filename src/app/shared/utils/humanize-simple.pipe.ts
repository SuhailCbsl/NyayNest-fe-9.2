import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'humanizeSimple',
})
export class HumanizeSimplePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    let s = value;

    // 1) Replace dots with spaces
    s = s.replace(/\./g, ' ');

    // 2) Insert spaces before camelCase boundaries
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2'); // abcDef → abc Def
    s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); // CNRNo → CNR No

    // 3) Collapse multiple spaces
    s = s.replace(/\s+/g, ' ').trim();

    // 4) Capitalize each word (keep acronyms)
    return s
      .split(' ')
      .map((word) =>
        /^[A-Z0-9]{2,}$/.test(word) // keep acronyms like CNR
          ? word
          : word[0].toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(' ');
  }
}
