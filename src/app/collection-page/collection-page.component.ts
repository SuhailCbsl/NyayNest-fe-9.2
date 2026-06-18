import { AsyncPipe, JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
} from '@angular/core';
import {
  ActivatedRoute,
  Router,
  NavigationEnd,
  RouterModule,
  RouterOutlet,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import {
  filter,
  map,
  mergeMap,
  startWith,
  switchMap,
  take,
} from 'rxjs/operators';

import { APP_CONFIG, AppConfig } from '../../config/app-config.interface';

import { AuthService } from '../core/auth/auth.service';
import { DSONameService } from '../core/breadcrumbs/dso-name.service';
import {
  SortDirection,
  SortOptions,
} from '../core/cache/models/sort-options.model';
import { AuthorizationDataService } from '../core/data/feature-authorization/authorization-data.service';
import { FeatureID } from '../core/data/feature-authorization/feature-id';
import { PaginatedList } from '../core/data/paginated-list.model';
import { RemoteData } from '../core/data/remote-data';
import { DSpaceObjectType } from '../core/shared/dspace-object-type.model';
import { redirectOn4xx } from '../core/shared/authorized.operators';
import { Bitstream } from '../core/shared/bitstream.model';
import { Collection } from '../core/shared/collection.model';
import { Item } from '../core/shared/item.model';
import {
  getAllSucceededRemoteDataPayload,
  getFirstSucceededRemoteData,
  toDSpaceObjectListRD,
} from '../core/shared/operators';
import { SearchService } from '../core/shared/search/search.service';

import { fadeIn, fadeInOut } from '../shared/animations/fade';

import { ThemedComcolPageBrowseByComponent } from '../shared/comcol/comcol-page-browse-by/themed-comcol-page-browse-by.component';
import { ThemedComcolPageContentComponent } from '../shared/comcol/comcol-page-content/themed-comcol-page-content.component';
import { ThemedComcolPageHandleComponent } from '../shared/comcol/comcol-page-handle/themed-comcol-page-handle.component';

import { ComcolPageHeaderComponent } from '../shared/comcol/comcol-page-header/comcol-page-header.component';
import { ComcolPageLogoComponent } from '../shared/comcol/comcol-page-logo/comcol-page-logo.component';

import { DsoEditMenuComponent } from '../shared/dso-page/dso-edit-menu/dso-edit-menu.component';

import { hasValue, isNotEmpty } from '../shared/empty.util';

import { ErrorComponent } from '../shared/error/error.component';

import { ThemedLoadingComponent } from '../shared/loading/themed-loading.component';

import { ObjectCollectionComponent } from '../shared/object-collection/object-collection.component';

import { PaginationComponentOptions } from '../shared/pagination/pagination-component-options.model';

import { PaginatedSearchOptions } from '../shared/search/models/paginated-search-options.model';

import { VarDirective } from '../shared/utils/var.directive';

import { getCollectionPageRoute } from './collection-page-routing-paths';
import { followLink } from '../shared/utils/follow-link-config.model';
import { PaginationService } from '../core/pagination/pagination.service';

@Component({
  standalone: true,
  selector: 'ds-base-collection-page',
  styleUrls: ['./collection-page.component.scss'],
  templateUrl: './collection-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn, fadeInOut],
  imports: [
    AsyncPipe,
    ComcolPageHeaderComponent,
    ComcolPageLogoComponent,
    ErrorComponent,
    RouterModule,
    RouterOutlet,
    ThemedComcolPageBrowseByComponent,
    ThemedComcolPageContentComponent,
    ThemedComcolPageHandleComponent,
    ThemedLoadingComponent,
    TranslateModule,
    VarDirective,
    ObjectCollectionComponent,
  ],
})
export class CollectionPageComponent implements OnInit {
  collectionRD$: Observable<RemoteData<Collection>>;

  logoRD$: Observable<RemoteData<Bitstream>>;

  itemRD$: Observable<RemoteData<PaginatedList<Item>>>;

  paginationConfig: PaginationComponentOptions;

  sortConfig: SortOptions;

  /**
   * Whether current user is collection admin
   */
  isCollectionAdmin$: Observable<boolean>;

  /**
   * Route to collection page
   */
  collectionPageRoute$: Observable<string>;

  showRecentSubmissions$: Observable<boolean>;

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected authService: AuthService,
    protected authorizationDataService: AuthorizationDataService,
    protected searchService: SearchService,
    protected paginationService: PaginationService,
    @Inject(APP_CONFIG) public appConfig: AppConfig,
    public dsoNameService: DSONameService,
  ) {
    this.paginationConfig = Object.assign(new PaginationComponentOptions(), {
      id: 'cp',
      currentPage: 1,
      pageSize: this.appConfig.browseBy.pageSize,
    });

    this.sortConfig = new SortOptions(
      'dc.date.accessioned',
      SortDirection.DESC,
    );
  }

  ngOnInit(): void {
    this.collectionRD$ = this.route.data.pipe(
      map((data) => data.dso as RemoteData<Collection>),
      redirectOn4xx(this.router, this.authService),
      take(1),
    );

    this.logoRD$ = this.collectionRD$.pipe(
      map((rd: RemoteData<Collection>) => rd.payload),
      filter((collection: Collection) => hasValue(collection)),
      mergeMap((collection: Collection) => collection.logo),
    );

    this.isCollectionAdmin$ = this.authorizationDataService.isAuthorized(
      FeatureID.IsCollectionAdmin,
    );

    this.collectionPageRoute$ = this.collectionRD$.pipe(
      getAllSucceededRemoteDataPayload(),
      map((collection) => getCollectionPageRoute(collection.id)),
    );

    /**
     * Load collection items directly
     * (same behavior as DSpace 7.x recent submissions)
     */
    this.itemRD$ = this.collectionRD$.pipe(
      getFirstSucceededRemoteData(),
      switchMap((rd) => {
        const collectionId = rd.payload.id;

        return this.paginationService
          .getCurrentPagination(this.paginationConfig.id, this.paginationConfig)
          .pipe(
            switchMap((pagination) =>
              this.searchService.search<Item>(
                new PaginatedSearchOptions({
                  scope: collectionId,
                  dsoTypes: [DSpaceObjectType.ITEM],
                  pagination: pagination,
                  sort: {
                    field: 'dc.date.accessioned',
                    direction: SortDirection.DESC,
                  },
                }),
                undefined,
                true,
                true,
                followLink('thumbnail'),
              ),
            ),
            toDSpaceObjectListRD(),
          );
      }),
    );

    this.showRecentSubmissions$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url.includes('/search')),
    );
  }

  isNotEmpty(object: any) {
    return isNotEmpty(object);
  }
}
