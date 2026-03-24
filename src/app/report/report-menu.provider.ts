import { Injectable } from '@angular/core';
import { AbstractExpandableMenuProvider } from '../shared/menu/providers/helper-providers/expandable-menu-provider';
import { AuthorizationDataService } from '../core/data/feature-authorization/authorization-data.service';
import { map, Observable } from 'rxjs';
import { PartialMenuSection } from '../shared/menu/menu-provider.model';
import { FeatureID } from '../core/data/feature-authorization/feature-id';
import { MenuItemType } from '../shared/menu/menu-item-type.model';
import { TextMenuItemModel } from '../shared/menu/menu-item/models/text.model';
import { LinkMenuItemModel } from '../shared/menu/menu-item/models/link.model';
import { MenuID } from '../shared/menu/menu-id.model';

@Injectable()
export class ReportMenuProvider extends AbstractExpandableMenuProvider {
  constructor(protected authService: AuthorizationDataService) {
    super();
    this.menuID = MenuID.ADMIN;
    this.index = 3;
  }
  /**
   * Return top section of report
   */
  getTopSection(): Observable<PartialMenuSection> {
    return this.authService.isAuthorized(FeatureID.AdministratorOf).pipe(
      map((isAdmin: boolean) => ({
        visible: isAdmin,
        model: {
          type: MenuItemType.TEXT,
          text: 'menu.section.reports',
        } as TextMenuItemModel,
        icon: 'file-lines',
      })),
    );
  }

  /**
   * It should have AuditTrailReport, DataTrendReport and DataUploadReport as sub-sections
   */
  getSubSections(): Observable<PartialMenuSection[]> {
    return this.authService.isAuthorized(FeatureID.AdministratorOf).pipe(
      map((isAdmin: boolean) => {
        const visible = isAdmin;
        return [
          {
            visible,
            model: {
              type: MenuItemType.LINK,
              text: 'menu.section.reports.audittrail',
              link: '/report/audittrail',
            } as LinkMenuItemModel,
            icon: 'history',
          },
          {
            visible,
            model: {
              type: MenuItemType.LINK,
              text: 'menu.section.reports.data-upload',
              link: '/report/dataupload',
            } as LinkMenuItemModel,
            icon: 'upload',
          },
          {
            visible,
            model: {
              type: MenuItemType.LINK,
              text: 'menu.section.reports.datatrend',
              link: '/report/datatrend',
            } as LinkMenuItemModel,
            icon: 'chart-line',
          },
        ];
      }),
    );
  }
}
