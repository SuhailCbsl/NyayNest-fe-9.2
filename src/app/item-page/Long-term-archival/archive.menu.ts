/**
 * The contents of this file are subject to the license and copyright
 * detailed in the LICENSE and NOTICE files at the root of the source
 * tree and available online at
 *
 * http://www.dspace.org/license/
 */

import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  combineLatest as observableCombineLatest,
  map,
  Observable,
  of,
} from 'rxjs';
import { AuthorizationDataService } from 'src/app/core/data/feature-authorization/authorization-data.service';
import { FeatureID } from 'src/app/core/data/feature-authorization/feature-id';
import { MenuItemType } from 'src/app/shared/menu/menu-item-type.model';
import { PartialMenuSection } from 'src/app/shared/menu/menu-provider.model';
import { AbstractExpandableMenuProvider } from 'src/app/shared/menu/providers/helper-providers/expandable-menu-provider';

/**
 * Menu provider to create the "Archive" menu (and subsections) in the admin sidebar
 */
@Injectable()
export class ArchiveMenuProvider extends AbstractExpandableMenuProvider {
  constructor(
    protected authorizationService: AuthorizationDataService,
    protected modalService: NgbModal,
  ) {
    super();
  }

  public getTopSection(): Observable<PartialMenuSection> {
    return of({
      model: {
        type: MenuItemType.TEXT,
        text: 'menu.section.longTermArchival',
      },
      icon: 'box-archive',
      visible: true,
    });
  }

  public getSubSections(): Observable<PartialMenuSection[]> {
    return observableCombineLatest([
      this.authorizationService.isAuthorized(FeatureID.AdministratorOf),
    ]).pipe(
      map(([authorized]) => {
        return [
          {
            visible: authorized,
            model: {
              type: MenuItemType.LINK,
              text: 'menu.section.archivedFiles',
              link: '/admin/longtermarchival/archivefiles',
            },
          },
          {
            visible: authorized,
            model: {
              type: MenuItemType.LINK,
              text: 'menu.section.allArchivedFiles',
              link: '/admin/longtermarchival/allarchivedfiles',
            },
          },
        ];
      }),
    );
  }
}
