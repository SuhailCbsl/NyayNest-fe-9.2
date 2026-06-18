import { AsyncPipe, NgClass } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Item } from '../../../../../../core/shared/item.model';
import { ViewMode } from '../../../../../../core/shared/view-mode.model';
import { getItemPageRoute } from '../../../../../../item-page/item-page-routing-paths';
import { ThemedThumbnailComponent } from '../../../../../../thumbnail/themed-thumbnail.component';
import { ThemedBadgesComponent } from '../../../../../object-collection/shared/badges/themed-badges.component';
import { ItemSearchResult } from '../../../../../object-collection/shared/item-search-result.model';
import { listableObjectComponent } from '../../../../../object-collection/shared/listable-object/listable-object.decorator';
import { TruncatableComponent } from '../../../../../truncatable/truncatable.component';
import { TruncatablePartComponent } from '../../../../../truncatable/truncatable-part/truncatable-part.component';
import { SearchResultListElementComponent } from '../../../search-result-list-element.component';
import { ItemAdminSearchResultActionsComponent } from 'src/app/admin/admin-search-page/admin-search-results/item-admin-search-result-actions.component';
import { ThumbnailComponent } from 'src/themes/custom/app/thumbnail/thumbnail.component';

@listableObjectComponent(ItemSearchResult, ViewMode.ListElement)
@Component({
  selector: 'ds-item-search-result-list-element',
  styleUrls: ['./item-search-result-list-element.component.scss'],
  templateUrl: './item-search-result-list-element.component.html',
  imports: [AsyncPipe, RouterLink, ThemedThumbnailComponent],
})
/**
 * The component for displaying a list element for an item search result of the type Publication
 */
export class ItemSearchResultListElementComponent
  extends SearchResultListElementComponent<ItemSearchResult, Item>
  implements OnInit
{
  itemPageRoute: string;

  ngOnInit(): void {
    super.ngOnInit();
    console.log('CUSTOM COMPONENT LOADED');
    console.log('Thumbnail=', this.dso?.thumbnail);
    console.log('dso = ', this.dso);
    console.log('dso links = ' + this.dso._links);
    console.log('thumbnail observable', this.dso.thumbnail);
    console.log('thumbnail link', this.dso._links?.thumbnail);

    // thumbnail setting (same as public)
    this.showThumbnails =
      this.showThumbnails ?? this.appConfig.browseBy.showThumbnails;

    // route for item click
    this.itemPageRoute = `/items/${this.dso.uuid}/doc-view`;
  }

  highlight(field: string): string {
    const highlight = (this.object?.indexableObject as any)?.highlight;

    if (highlight && highlight[field] && highlight[field].length > 0) {
      return highlight[field][0]; // already contains <em>
    }

    return this.dso.firstMetadataValue(field);
  }
}
