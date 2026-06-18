import { Component, Inject, OnInit } from '@angular/core';

import { Context } from '../../../../../core/shared/context.model';
import { Item } from '../../../../../core/shared/item.model';
import { ViewMode } from '../../../../../core/shared/view-mode.model';
import { ItemSearchResult } from '../../../../../shared/object-collection/shared/item-search-result.model';
import { listableObjectComponent } from '../../../../../shared/object-collection/shared/listable-object/listable-object.decorator';
import { SearchResultListElementComponent } from '../../../../../shared/object-list/search-result-list-element/search-result-list-element.component';
import { ItemAdminSearchResultActionsComponent } from '../../item-admin-search-result-actions.component';
import { ThemedThumbnailComponent } from 'src/app/thumbnail/themed-thumbnail.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { TruncatableService } from 'src/app/shared/truncatable/truncatable.service';
import { DSONameService } from 'src/app/core/breadcrumbs/dso-name.service';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { AuthService } from 'src/app/core/auth/auth.service';
import { AuthorizationDataService } from 'src/app/core/data/feature-authorization/authorization-data.service';
import { FeatureID } from 'src/app/core/data/feature-authorization/feature-id';

@listableObjectComponent(
  ItemSearchResult,
  ViewMode.ListElement,
  Context.AdminSearch,
)
@Component({
  selector: 'ds-item-admin-search-result-list-element',
  styleUrls: ['./item-admin-search-result-list-element.component.scss'],
  templateUrl: './item-admin-search-result-list-element.component.html',
  imports: [
    CommonModule,
    ItemAdminSearchResultActionsComponent,
    ThemedThumbnailComponent,
    RouterModule,
  ],
})
/**
 * The component for displaying a list element for an item search result on the admin search page
 */
export class ItemAdminSearchResultListElementComponent
  extends SearchResultListElementComponent<ItemSearchResult, Item>
  implements OnInit
{
  itemPageRoute: string;
  isAdmin$: Observable<boolean>;

  constructor(
    private tructableService: TruncatableService,
    public dsoNameService: DSONameService,
    protected authService: AuthorizationDataService,
    @Inject(APP_CONFIG) protected appConfig?: AppConfig,
  ) {
    super(tructableService, dsoNameService, appConfig);
  }

  ngOnInit(): void {
    super.ngOnInit();

    // thumbnail setting (same as public)
    this.showThumbnails =
      this.showThumbnails ?? this.appConfig.browseBy.showThumbnails;

    // route for item click
    this.itemPageRoute = `/items/${this.dso.uuid}/doc-view`;
    this.isAdmin$ = this.authService.isAuthorized(FeatureID.AdministratorOf);
  }

  highlight(field: string): string {
    const highlight = (this.object?.indexableObject as any)?.highlight;

    if (highlight && highlight[field] && highlight[field].length > 0) {
      return highlight[field][0]; // already contains <em>
    }

    return this.dso.firstMetadataValue(field);
  }
}
