import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SearchService } from '../../core/shared/search/search.service';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { HttpClient } from '@angular/common/http';
import { DSpaceObjectType } from 'src/app/core/shared/dspace-object-type.model';
import { Item } from 'src/app/core/shared/item.model';
import { getFirstCompletedRemoteData } from 'src/app/core/shared/operators';
import { PaginationComponentOptions } from '../pagination/pagination-component-options.model';
import { PaginatedSearchOptions } from '../search/models/paginated-search-options.model';
import { SearchFilter } from '../search/models/search-filter.model';
import { followLink } from '../utils/follow-link-config.model';
import { getEntityPageRoute } from 'src/app/item-page/item-page-routing-paths';
import { NotificationsService } from '../notifications/notifications.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ThumbnailComponent } from 'src/app/thumbnail/thumbnail.component';
import { ThemedThumbnailComponent } from 'src/app/thumbnail/themed-thumbnail.component';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  standalone: true,
  selector: 'ds-customize-browse-by',
  styleUrls: ['./browse-by.component.scss'],
  templateUrl: './customize-browse-by.component.html',
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    RouterModule,
    ThemedThumbnailComponent,
    NgbPaginationModule,
  ],
})
export class CustomizeBrowseByComponent implements OnInit {
  browseId: string;
  isCustomCaseBrowse = false;
  caseNo: string = '';
  caseType: string = '';
  caseYear: string = '';
  results$ = new BehaviorSubject<any[]>([]);
  loading = false;
  caseTypeSuggestions: any[] = [];
  caseNoSuggestions: any[] = [];
  caseYearSuggestions: any[] = [];
  resultsRD$ = new BehaviorSubject<any>(null);
  showThumbnails: any;
  currentView: string = 'list';
  hasSearched: boolean = false;
  filterTags: any[] = [];
  results: any[] = [];
  paginatedResults: any[] = [];
  currentPage = 1;
  pageSize = 10;
  totalResults = 0;
  resultsPerPage: number = 10;
  resultPerPage: string = '10';
  state: string;

  constructor(
    private route: ActivatedRoute,
    private searchService: SearchService,
    private http: HttpClient,
    private notificationsService: NotificationsService,
    private cdr: ChangeDetectorRef,
    @Inject(APP_CONFIG) protected appConfig?: AppConfig,
  ) {
    this.showThumbnails =
      this.showThumbnails ?? this.appConfig.browseBy.showThumbnails;
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.browseId = params['id'];
      if (this.browseId === 'CaseTypeNameCaseNoCaseYear') {
        this.isCustomCaseBrowse = true;
        console.log('Custom Case Browse Activated');
      } else {
        this.isCustomCaseBrowse = false;
      }
    });
  }

  private fetchSuggestions(field: string, prefix: string) {
    const apiUrl = `${this.appConfig.rest.baseUrl}/api/discover/facets/${field}?prefix=${prefix}&configuration=administrativeView&size=5`;
    return this.http.get<any>(apiUrl);
  }

  onCaseTypeInput() {
    if (!this.caseType) {
      this.caseTypeSuggestions = [];
      return;
    }

    this.fetchSuggestions('CaseTypeName', this.caseType).subscribe((res) => {
      this.caseTypeSuggestions = res?._embedded?.values || [];
    });
  }

  selectCaseType(s: any) {
    this.caseType = s.label;
    this.caseTypeSuggestions = [];
  }

  onCaseNoInput() {
    if (!this.caseNo) {
      this.caseNoSuggestions = [];
      return;
    }

    this.fetchSuggestions('title', this.caseNo).subscribe((res) => {
      this.caseNoSuggestions = res?._embedded?.values || [];
    });
  }

  selectCaseNo(s: any) {
    this.caseNo = s.label;
    this.caseNoSuggestions = [];
  }

  onCaseYearInput() {
    if (!this.caseYear) {
      this.caseYearSuggestions = [];
      return;
    }

    this.fetchSuggestions('CaseYear', this.caseYear.toString()).subscribe(
      (res) => {
        this.caseYearSuggestions = res?._embedded?.values || [];
      },
    );
  }

  selectCaseYear(s: any) {
    this.caseYear = s.label;
    this.caseYearSuggestions = [];
  }

  clearSuggestionsWithDelay() {
    setTimeout(() => {
      this.caseTypeSuggestions = [];
      this.caseNoSuggestions = [];
      this.caseYearSuggestions = [];
    }, 200);
  }

  searchCases(): void {
    if (
      this.filterTags.length === 0 &&
      !this.caseType &&
      !this.caseNo &&
      !this.caseYear
    ) {
      this.notificationsService.warning(
        null,
        'Please enter at least one search field (Case Type, Case Number, or Case Year)',
      );
      this.resetFilters();
      return;
    }
    if (
      !this.caseType &&
      !this.caseNo &&
      !this.caseYear &&
      this.filterTags.length === 1
    ) {
      // this.notificationsService.warning(
      //     null,
      //     'Please enter at least one search field (Case Type, Case Number, or Case Year) to see results.'
      // );
      this.resetFilters();
      return;
    }
    this.hasSearched = false;
    this.loading = true;
    const filters: SearchFilter[] = [];
    this.filterTags = [];
    if (this.caseType) {
      this.filterTags.push({ label: 'CaseTypeName', value: this.caseType });

      filters.push(
        new SearchFilter('f.CaseTypeName', [this.caseType], 'equals'),
      );
    }
    if (this.caseNo) {
      this.filterTags.push({ label: 'title', value: this.caseNo });

      filters.push(new SearchFilter('f.title', [this.caseNo], 'equals'));
    }
    if (this.caseYear) {
      this.filterTags.push({ label: 'CaseYear', value: this.caseYear });

      filters.push(new SearchFilter('f.CaseYear', [this.caseYear], 'equals'));
    }
    const pagination = new PaginationComponentOptions();
    pagination.currentPage = this.currentPage;
    pagination.pageSize = this.resultsPerPage;
    const searchOptions = new PaginatedSearchOptions({
      query: '*:*',
      filters: filters,
      pagination: pagination,
      configuration: 'administrativeView',
      dsoTypes: [DSpaceObjectType.ITEM],
    });
    const followLinks = [followLink<Item>('thumbnail', { isOptional: true })];
    this.searchService
      .search(searchOptions, undefined, true, true, ...followLinks)
      .pipe(getFirstCompletedRemoteData())
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.hasSearched = true;
          if (res?.hasSucceeded) {
            this.totalResults = res.payload.pageInfo?.totalElements || 0;
            this.resultsRD$.next(res);
          } else {
            this.resultsRD$.next(null);
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.hasSearched = false;
          this.resultsRD$.next(null);
          this.cdr.detectChanges();
        },
      });
  }

  updatePagination() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedResults = this.results.slice(start, end);
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.searchCases();
  }

  onResultsPerPageChange() {
    this.resultsPerPage = parseInt(this.resultPerPage, 10) || 10;
    this.currentPage = 1;
    this.searchCases();
  }

  getResultsRange(): string {
    if (!this.totalResults || this.totalResults === 0) {
      return '0-0';
    }
    const start = (this.currentPage - 1) * this.resultsPerPage + 1;
    const end = Math.min(
      this.currentPage * this.resultsPerPage,
      this.totalResults,
    );
    return `${start}-${end}`;
  }

  removeFilterTag(index: number): void {
    const removed = this.filterTags[index];
    if (removed.label === 'CaseTypeName') this.caseType = '';
    if (removed.label === 'title') this.caseNo = '';
    if (removed.label === 'CaseYear') this.caseYear = '';
    this.currentPage = 1;
    this.searchCases();
  }

  getCaseField(result: any, field: string): string {
    return (
      result?.indexableObject?.metadata?.[`dc.${field}`]?.[0]?.value || '-'
    );
  }

  resetFilters(): void {
    this.caseNo = '';
    this.caseType = '';
    this.caseYear = '';
    this.filterTags = [];
    this.hasSearched = false;
    this.loading = false;
    this.resultsRD$.next(null);
  }

  async getState(): Promise<void> {
    const stateData = await firstValueFrom(
      this.http.get<{ state: string }>('assets/dynamicStateValue.json'),
    );
    this.state = stateData.state;
  }

  getItemPageRouteLocal(result: any): string {
    return getEntityPageRoute(
      result?.indexableObject?.type,
      result?.indexableObject?.uuid,
    );
  }
}
