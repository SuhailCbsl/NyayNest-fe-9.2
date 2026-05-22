import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'removePrefix',
})
export class RemovePrefixPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    // Remove everything before the FIRST dot: dc.X → X
    const idx = value.indexOf('.');
    return idx >= 0 ? value.substring(idx + 1) : value;
  }
}
