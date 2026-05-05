import { Component } from '@angular/core';
import { ThemedComponent } from '../../shared/theme-support/themed.component';
import { ItemPageDocViewComponent } from './item-page-doc-view.component';

@Component({
  standalone: true,
  selector: 'themed-item-page-doc-view',
  styleUrls: [],
  templateUrl: '../../shared/theme-support/themed.component.html',
})
export class ThemedItemPageDocViewComponent extends ThemedComponent<ItemPageDocViewComponent> {
  protected getComponentName(): string {
    return 'ItemPageDocViewComponent';
  }

  protected importThemedComponent(themeName: string): Promise<any> {
    return import(
      `../../../themes/${themeName}/app/item-page/doc-view/item-page-doc-view.component`
    );
  }

  protected importUnthemedComponent(): Promise<any> {
    return import('./item-page-doc-view.component');
  }
}
