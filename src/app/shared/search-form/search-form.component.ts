import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  Output,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NgbDateParserFormatter,
  NgbDatepicker,
  NgbDatepickerModule,
  NgbDateStruct,
  NgbInputDatepicker,
  NgbModal,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from '../../core/data/dspace-object-data.service';
import { PaginationService } from '../../core/pagination/pagination.service';
import { DSpaceObject } from '../../core/shared/dspace-object.model';
import { getFirstSucceededRemoteDataPayload } from '../../core/shared/operators';
import { SearchService } from '../../core/shared/search/search.service';
import { SearchConfigurationService } from '../../core/shared/search/search-configuration.service';
import { SearchFilterService } from '../../core/shared/search/search-filter.service';
import { hasValue, isNotEmpty } from '../empty.util';
import { currentPath } from '../utils/route.utils';
import { ScopeSelectorModalComponent } from './scope-selector-modal/scope-selector-modal.component';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { NgbDateDdMmYyyyParserFormatter } from 'src/app/report/audit-trail-report/ngb-date-formatter';
import { SearchFilterConfig } from '../search/models/search-filter-config.model';
import { SearchResult } from '../search/models/search-result.model';
import { RemoteData } from 'src/app/core/data/remote-data';
import { PaginatedList } from 'src/app/core/data/paginated-list.model';
import { Item } from 'src/app/core/shared/item.model';
import { DatePicker } from 'primeng/datepicker';
import { SEARCH_CONFIG_SERVICE } from 'src/app/my-dspace-page/my-dspace-configuration.service';
import { HttpClient } from '@angular/common/http';
import { NotificationsService } from '../notifications/notifications.service';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { SearchFilter } from '../search/models/search-filter.model';

interface FilterTag {
  label: string;
  value: string;
  type: string;
}

@Component({
  selector: 'ds-base-search-form',
  styleUrls: ['./search-form.component.scss'],
  templateUrl: './search-form.component.html',
  imports: [
    AsyncPipe,
    FormsModule,
    NgbTooltipModule,
    TranslateModule,
    ButtonModule,
    PopoverModule,
    NgbDatepickerModule,
  ],
  providers: [
    {
      provide: NgbDateParserFormatter,
      useClass: NgbDateDdMmYyyyParserFormatter,
    },
  ],
})
/**
 * Component that represents the search form
 */
export class SearchFormComponent implements OnChanges {
  /**
   * The search query
   */
  @Input() query: string;

  /**
   * True when the search component should show results on the current page
   */
  @Input() inPlaceSearch: boolean;

  /**
   * The currently selected scope object's UUID
   */
  @Input()
  scope = '';

  /**
   * Hides the scope in the url, this can be useful when you hardcode the scope in another way
   */
  @Input() hideScopeInUrl = false;

  selectedScope: BehaviorSubject<DSpaceObject> =
    new BehaviorSubject<DSpaceObject>(undefined);

  @Input() currentUrl: string;

  /**
   * Whether or not the search button should be displayed large
   */
  @Input() large = false;

  /**
   * The brand color of the search button
   */
  @Input() brandColor = 'primary';

  /**
   * The placeholder of the search input
   */
  @Input() searchPlaceholder: string;

  /**
   * Defines whether or not to show the scope selector
   */
  @Input() showScopeSelector = false;

  /**
   * Output the search data on submit
   */
  @Output() submitSearch = new EventEmitter<any>();

  searchMetadata: string = '';
  currentView: string = 'list';
  filterTags: FilterTag[] = [];
  availableFilters: SearchFilterConfig[] = [];
  appliedFilterTypes: Set<string> = new Set();

  sortBy: string = 'dc.date.accessioned';
  sortOrder: string = 'desc';
  resultPerPage: string = '10';
  searchCaseBy: string = '';

  currentPage: number = 1;
  totalResults: number = 0;
  resultsPerPage: number = 10;
  temp: any;

  searchType: 'phonetic' | 'fuzzy' | 'normal' = 'normal';

  searchResults: any[] = [];
  // isLoading: boolean = false;

  /**
   * Route to the item's page
   */
  itemPageRoute: string;

  /**
   * The current search results
   */
  resultsRD$: BehaviorSubject<
    RemoteData<PaginatedList<SearchResult<DSpaceObject>>>
  > = new BehaviorSubject(null);
  resultItem: Item;

  suggestions: string[] = [];

  showThumbnails: any;

  @Input() filters: Observable<RemoteData<SearchFilterConfig[]>>;
  @Input() filter: SearchFilterConfig;
  @Input() currentScope: string;
  @Input() refreshFilters: BehaviorSubject<boolean>;
  @ViewChild('fromCal') fromCal: DatePicker | undefined;
  @ViewChild('toCal') toCal: DatePicker | undefined;
  @ViewChild('dFrom') dFromPicker!: NgbInputDatepicker | undefined;
  @ViewChild('dTo') dToPicker!: NgbInputDatepicker | undefined;
  @ViewChild('fromNativeInput') fromNativeInput!: ElementRef<HTMLInputElement>;
  @ViewChild('toNativeInput') toNativeInput!: ElementRef<HTMLInputElement>;

  @Output() isVisibilityComputed = new EventEmitter<boolean>();
  @Output() deselectObject: EventEmitter<any> = new EventEmitter<any>();
  @Output() selectObject: EventEmitter<any> = new EventEmitter<any>();

  filtersWithComputedVisibility = 0;
  caseTypeNameFilter: string;
  caseNatureFilter: string;
  dashboardFlag: any = 'false';
  searchBarFlag: string = '';
  searchBarValue: string = '';
  uuidFromDashBoard: any;
  byDefaultSearchCaseByselectOnReset: string = '';
  defaultScope: DSpaceObject | undefined;
  isReset: boolean = false;
  private dashboardInitialized: boolean = false;

  selectedFromDate: Date | null = null;
  selectedToDate: Date | null = null;

  fromDateModel: NgbDateStruct | null = null;
  toDateModel: NgbDateStruct | null = null;

  fromYear: number | null = null;
  toYear: number | null = null;

  // true when a date range is active (until user calls resetAllFilters)
  private dateScopeActive: boolean = false;

  @ViewChild('op') overlayPanel!: Popover;

  // Supported date fields for range filtering
  public DATE_FIELDS: string[] = [
    'RegistrationDate',
    'DateofDisposal',
    'OrderJudgementDate',
    'FIRDate',
    'ChargesheetNoDate',
    'FilingDate',
    'DateofDocument',
    'digitizationDate',
  ];

  // Supported year fields for range filtering
  public YEAR_FIELDS: string[] = [
    'FilingYear',
    'ConnectedCaseYear',
    'FIRYear',
    'CaseYear',
  ];

  // Generic date properties used by the date-range picker
  dateFrom: NgbDateStruct | null = null;
  dateTo: NgbDateStruct | null = null;

  // expose for UI tag display (so removeFilterTag can remove it)
  private DATE_FILTER_TYPE = 'lastModified';

  // internal query string sent to Discovery/DSpace backend (not shown to user)
  private internalQuery: string | null = null;
  dateRange: Date[] | null = null; // [fromDate, toDate]
  state: string;

  // store date range as a SearchFilter (used internally)
  private dateRangeFilter: SearchFilter | null = null;

  constructor(
    protected router: Router,
    protected searchService: SearchService,
    protected searchFilterService: SearchFilterService,
    protected paginationService: PaginationService,
    protected searchConfig: SearchConfigurationService,
    protected modalService: NgbModal,
    protected dsoService: DSpaceObjectDataService,
    public dsoNameService: DSONameService,
    protected route: ActivatedRoute,
    @Inject(SEARCH_CONFIG_SERVICE)
    private searchConfigService: SearchConfigurationService,
    protected http: HttpClient,
    private notificationService: NotificationsService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdf: ChangeDetectorRef,
    @Inject(APP_CONFIG) protected appConfig?: AppConfig,
  ) {}

  /**
   * Retrieve the scope object from the URL so we can show its name
   */
  ngOnChanges(): void {
    if (isNotEmpty(this.scope)) {
      this.dsoService
        .findById(this.scope)
        .pipe(getFirstSucceededRemoteDataPayload())
        .subscribe((scope: DSpaceObject) => this.selectedScope.next(scope));
    }
  }

  /**
   * Updates the search when the form is submitted
   * @param data Values submitted using the form
   */
  onSubmit(data: any) {
    if (isNotEmpty(this.scope)) {
      data = Object.assign(data, { scope: this.scope });
    }
    this.updateSearch(data);
    this.submitSearch.emit(data);
  }

  /**
   * Updates the search when the current scope has been changed
   * @param {string} scope The new scope
   */
  onScopeChange(scope: DSpaceObject) {
    this.updateSearch({ scope: scope ? scope.uuid : undefined });
    this.searchFilterService.minimizeAll();
  }

  /**
   * Updates the search URL
   * @param data Updated parameters
   */
  updateSearch(data: any) {
    const goToFirstPage = { 'spc.page': 1 };

    const queryParams = Object.assign(
      {
        ...goToFirstPage,
      },
      data,
    );
    if (hasValue(data.scope) && this.hideScopeInUrl) {
      delete queryParams.scope;
    }

    void this.router.navigate(this.getSearchLinkParts(), {
      queryParams: queryParams,
      queryParamsHandling: 'merge',
    });
  }

  /**
   * @returns {string} The base path to the search page, or the current page when inPlaceSearch is true
   */
  public getSearchLink(): string {
    if (this.inPlaceSearch) {
      return currentPath(this.router);
    }
    return this.searchService.getSearchLink();
  }

  /**
   * @returns {string[]} The base path to the search page, or the current page when inPlaceSearch is true, split in separate pieces
   */
  public getSearchLinkParts(): string[] {
    if (this.inPlaceSearch) {
      return [];
    }
    return this.getSearchLink().split('/');
  }

  /**
   * Open the scope modal so the user can select DSO as scope
   */
  openScopeModal() {
    const ref = this.modalService.open(ScopeSelectorModalComponent);
    ref.componentInstance.scopeChange
      .pipe(take(1))
      .subscribe((scope: DSpaceObject) => {
        this.selectedScope.next(scope);
        this.onScopeChange(scope);
      });
  }

  selectSearchType(type: 'normal' | 'fuzzy' | 'phonetic') {
    this.searchType = type;
    this.currentPage = 1;

    this.overlayPanel.hide();
    this.updateSearch({});
  }

  resetAllFilters() {
    this.isReset = true;

    // Clear active scope and remove query params (including dateFrom/dateTo) ---
    this.selectedScope.next(undefined);

    void this.router.navigate([], {
      queryParams: {
        flag: null,
        name: null,
        casenature: null,
        uuid: null,
        scope: null,
        query: null,
        phonetic: null,
        'spc.page': null,
        dateFrom: null,
        dateTo: null,
      },
      queryParamsHandling: 'merge',
    });

    // Clear all date-related state (Dates + Ngb models + internal query + flags) ---
    this.selectedFromDate = null;
    this.selectedToDate = null;
    this.dateRange = null;
    this.dateRangeFilter = null;
    this.internalQuery = null;
    this.dateScopeActive = false;
    this.searchType = 'normal';
    // clear the Ngb models so ngModel becomes null
    this.fromDateModel = null;
    this.toDateModel = null;

    // close ngb pickers if open
    try {
      this.dFromPicker?.close();
      this.dToPicker?.close();
    } catch (e) {
      // ignore
    }

    // sync helper (if used elsewhere)
    this.syncDateModelsFromSelectedDates?.();

    // Remove any date from applied types (UI disabling)
    this.appliedFilterTypes.delete(this.DATE_FILTER_TYPE);

    // Clear search and filter state ---
    this.query = '';
    this.searchMetadata = null;
    this.searchCaseBy = '';
    this.filterTags = [];
    this.appliedFilterTypes.clear(); // (date removed above already)

    // Reset pagination/sorting/flags ---
    this.currentPage = 1;
    this.resultsPerPage = 10;
    this.resultPerPage = '10';
    this.sortBy = 'dc.title';
    this.sortOrder = 'asc';
    // this.phoneticEnabled = false;
    this.checkReset = 'true';
    this.isFilterDisabled('true');

    // Ensure any calendar overlays close if open (defensive) ---
    try {
      this.fromCal?.hideOverlay?.();
      this.toCal?.hideOverlay?.();
    } catch (e) {
      // ignore
    }

    // Apply DOM clears & re-run search after models are applied ---
    // Using microtask to ensure Angular has applied the model changes first
    setTimeout(() => {
      // restore default scope if you have one
      this.selectedScope.next(this.defaultScope);
      this.onScopeChange(this.defaultScope);

      // make sure Ngb models are null (defensive re-assign)
      this.fromDateModel = null;
      this.toDateModel = null;

      // final safety clears (re-assign to ensure template sees them)
      this.selectedFromDate = null;
      this.selectedToDate = null;
      this.internalQuery = null;
      this.dateScopeActive = false;

      // Clear the visible inputs (handles previously-typed invalid strings)
      try {
        this.clearDateInputs(); // must exist on the component (clears both from/to DOM inputs)
      } catch (e) {
        // fallback: try naive DOM selectors
        try {
          const f = document.querySelector<HTMLInputElement>('#fromDateInput');
          const t = document.querySelector<HTMLInputElement>('#toDateInput');
          if (f) {
            f.value = '';
            f.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (t) {
            t.value = '';
            t.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch (err) {
          /* ignore */
        }
      }

      // Force Angular to update the template immediately
      try {
        this.cdf.detectChanges();
      } catch (e) {}

      // now run a fresh search
      this.currentPage = 1;
      this.updateSearch({});
    }, 0);
  }

  private clearDateInputs(): void {
    try {
      if (this.fromNativeInput?.nativeElement) {
        this.fromNativeInput.nativeElement.value = '';
        this.fromNativeInput.nativeElement.dispatchEvent(
          new Event('input', { bubbles: true }),
        );
      }
      if (this.toNativeInput?.nativeElement) {
        this.toNativeInput.nativeElement.value = '';
        this.toNativeInput.nativeElement.dispatchEvent(
          new Event('input', { bubbles: true }),
        );
      }
    } catch (e) {
      console.warn('Date input clear failed:', e);
    } finally {
      this.cdf.detectChanges();
    }
  }

  checkReset: string = 'false';
  isFilterDisabled(filterName: string) {
    //   if (this.appliedFilterTypes.has(filterName) && (this.checkReset === 'false')){
    if (
      this.appliedFilterTypes.has(filterName) &&
      this.checkReset === 'false'
    ) {
      return true;
    } else {
      return false;
    }
  }

  onSearchCaseByChange(value) {
    this.byDefaultSearchCaseByselectOnReset = value;
    if (value) {
      this.searchMetadata = '';
    }
    this.temp = this.searchCaseBy;
  }

  addMetadataFilter() {
    if (
      this.byDefaultSearchCaseByselectOnReset === undefined ||
      this.byDefaultSearchCaseByselectOnReset === null ||
      this.byDefaultSearchCaseByselectOnReset === ''
    ) {
      this.notificationService.info(
        'Please fill/select all required fields before adding.',
      );
      return;
    }

    // Handle year fields
    if (this.isYearField(this.searchCaseBy)) {
      if (this.yearFrom == null || this.yearTo == null) {
        this.notificationService.info(
          'Please select both From and To years for the selected year filter.',
        );
        return;
      }
      if (this.yearFrom > this.yearTo) {
        this.notificationService.error('From Year must be before To Year.');
        return;
      }

      const fromYear = new Date(this.yearFrom).getFullYear();
      const toYear = new Date(this.yearTo).getFullYear();
      const yearRangeValue = `${fromYear} to ${toYear}`;
      this._addFilter(this.searchCaseBy, yearRangeValue);
      this.yearFrom = null;
      this.yearTo = null;
    } else if (this.isDateField(this.searchCaseBy)) {
      // Validate that both dates are selected
      if (!this.dateFrom || !this.dateTo) {
        this.notificationService.info(
          'Please select both F rom and To dates for the selected date filter.',
        );
        return;
      }

      // Format dates as YYYY-MM-DD
      const fromDateStr = this.formatNgbDateToString(this.dateFrom!);
      const toDateStr = this.formatNgbDateToString(this.dateTo!);

      // Validate date range
      if (fromDateStr > toDateStr) {
        this.notificationService.error('From Date must be before To Date.');
        return;
      }

      // Add filter with date range value
      const dateRangeValue = `${fromDateStr} to ${toDateStr}`;
      this._addFilter(this.searchCaseBy, dateRangeValue);

      // Clear date inputs
      this.dateFrom = null;
      this.dateTo = null;
    } else {
      // Handle standard text-based filters
      if (this.searchMetadata === '') {
        this.notificationService.info(
          'Please fill/select all required fields before adding.',
        );
        return;
      }
      this._addFilter(this.searchCaseBy, this.searchMetadata);
      this.searchMetadata = '';
    }

    this.searchCaseBy = '';
    this.currentPage = 1;
    this.checkReset = 'false';
    this.isFilterDisabled('true');
    this.updateSearch({});
  }

  onSortChange() {
    this.currentPage = 1;
    this.updateSearch({ sortBy: this.sortBy, sortOrder: this.sortOrder });
  }

  onSortOrderChange() {
    this.currentPage = 1;
    this.updateSearch({ sortBy: this.sortBy, sortOrder: this.sortOrder });
  }

  onResultPerPageChange() {
    this.currentPage = 1;
    this.updateSearch({ pageSize: this.resultPerPage });
  }

  // When you programmatically set selectedFromDate elsewhere (eg from URL params),
  // remember to sync models:
  private syncDateModelsFromSelectedDates() {
    this.fromDateModel = this.dateToStruct(this.selectedFromDate);
    this.toDateModel = this.dateToStruct(this.selectedToDate);
  }

  // helper: convert Date -> NgbDateStruct
  private dateToStruct(d: Date | null): NgbDateStruct | null {
    if (!d) return null;
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  private _addFilter(type: string, value: string) {
    // If this is the date-range filter, keep it internal only:
    if (type === this.DATE_FILTER_TYPE) {
      // Ensure we mark it as applied so other UI can disable/enable appropriately
      this.appliedFilterTypes.add(type);

      // Optionally store the raw value somewhere if you need to reference it later
      // (you already set this.dateRangeFilter elsewhere when user picks dates).
      return;
    }

    // For all non-date filters, keep the old behaviour (create visible tag once)
    if (!this.appliedFilterTypes.has(type)) {
      const filterConfig = this.availableFilters.find((f) => f.name === type);
      if (value !== null && value !== undefined && value !== '') {
        value = value.toLowerCase();
      }
      this.filterTags.push({
        label: filterConfig ? filterConfig.name : type,
        value,
        type,
      });
      this.appliedFilterTypes.add(type);
    }
  }

  /**
   * Convert NgbDateStruct to DD-MM-YYYY string format
   */
  private formatNgbDateToString(date: NgbDateStruct): string {
    if (!date) {
      return '';
    }
    const year = date.year;
    const month = String(date.month).padStart(2, '0');
    const day = String(date.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onFromDateModelChange(model: NgbDateStruct | null, which: 'from' | 'to') {
    const dt = this.structToDate(model);
    if (which === 'from') {
      this.selectedFromDate = dt;
      // if invalid order, simply clear the from model (no multiple warnings)
      if (
        this.selectedToDate &&
        dt &&
        dt.getTime() > this.selectedToDate.getTime()
      ) {
        // do not call notificationsService here — central place will warn when needed
        this.fromDateModel = null;
        this.selectedFromDate = null;
        return;
      }
      this.onFromDateChange(this.selectedFromDate);
    } else {
      this.selectedToDate = dt;
      if (
        this.selectedFromDate &&
        dt &&
        dt.getTime() < this.selectedFromDate.getTime()
      ) {
        this.toDateModel = null;
        this.selectedToDate = null;
        return;
      }
      this.onToDateChange(this.selectedToDate);
    }
  }

  onToDateChange(input: Date | string | null) {
    this.selectedToDate = this.normalizeToDate(input);
    // Try to auto-execute only when both dates are present
    // this.tryAutoDateSearch();
  }

  onToDateSelect(event: NgbDateStruct) {
    const dt = this.structToDate(event);
    this.selectedToDate = dt;
    this.onToDateChange(this.selectedToDate);
    if (this.selectedFromDate && this.selectedToDate) {
      this.tryAutoDateSearch();
    }
  }

  private tryAutoDateSearch() {
    const from = this.normalizeToDate(this.selectedFromDate);
    const to = this.normalizeToDate(this.selectedToDate);

    // Only proceed when both present
    // run centralized validation
    const err = this.validateDateRange(from, to);
    if (err) {
      // only show one warning
      this.notificationService.warning(err);
      return;
    }
    // Run date-range search
    if (from && to) {
      this.onDateRangeSearch();
    }
  }

  /** return validation message or null if OK */
  private validateDateRange(from: Date | null, to: Date | null): string | null {
    if (!from && !to) return null; // nothing chosen
    if (!from && to) return 'Please choose From Date before!';
    if (from && !to) return 'Please choose To Date after From Date!';
    if (from.getTime() > to.getTime())
      return 'From date must be before To date!';
    return null;
  }

  onDateRangeSearch() {
    const from = this.normalizeToDate(this.selectedFromDate);
    const to = this.normalizeToDate(this.selectedToDate);

    if (!from || !to || from.getTime() > to.getTime()) {
      // defensive return, do not show notification (it was already shown by caller)
      return;
    }

    // Build inclusive ISO range (start of from -> end of to)
    const fromIso = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
      0,
      0,
      0,
      0,
    ).toISOString();
    const toIso = new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate(),
      23,
      59,
      59,
      999,
    ).toISOString();

    // IMPORTANT: set as internalQuery (Solr-style range) rather than a SearchFilter
    this.internalQuery = `lastModified:[${fromIso} TO ${toIso}]`;

    this.dateScopeActive = true;
    // Defensive: remove any visible date tag (you said you don't want it)
    this.filterTags = this.filterTags.filter(
      (t) => t.type !== this.DATE_FILTER_TYPE,
    );

    // write date range into route query params so it survives navigation/back
    void this.router.navigate(this.getSearchLinkParts(), {
      queryParams: {
        dateFrom: fromIso,
        dateTo: toIso,
        'spc.page': 1, // go to first page
      },
      queryParamsHandling: 'merge',
      skipLocationChange: false, // keep in URL so back-button works
    });
    // Keep appliedFilterTypes if you use it for UI disabling, do not delete it here
    this.appliedFilterTypes.add(this.DATE_FILTER_TYPE);

    // Next, ensure typed searches take precedence across calls — we already do that in updateResults()
    this.currentPage = 1;
    this.updateSearch({});

    // Hide calendar overlays if possible
    try {
      this.fromCal?.hideOverlay?.();
      this.toCal?.hideOverlay?.();
    } catch (e) {
      /* ignore */
    }
  }

  // If you want to react to the dateSelect specifically (the calendar pick event)
  onFromDateSelect(event: NgbDateStruct) {
    const dt = this.structToDate(event);
    this.selectedFromDate = dt;
    // behave same as when user has both dates
    this.onFromDateChange(this.selectedFromDate);
    // optionally trigger auto-search when both are present:
    if (this.selectedFromDate && this.selectedToDate) {
      this.tryAutoDateSearch(); // you already have this
    }
  }

  // helper for search
  private normalizeToDate(input: Date | string | null): Date | null {
    if (!input) return null;

    if (input instanceof Date && !isNaN(input.getTime())) {
      const d = new Date(input);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    // if it's a dd/mm/yyyy string (common because p-calendar displays that format),
    // try to parse it safely
    if (typeof input === 'string') {
      // try dd/mm/yyyy first
      const dm = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dm) {
        const day = Number(dm[1]);
        const month = Number(dm[2]) - 1; // zero-based
        const year = Number(dm[3]);
        const d = new Date(year, month, day);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      // fallback: try Date constructor for ISO strings
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }

    return null;
  }

  /**
   * Called when primeNG p-calendar triggers selection.
   * If a full range exists (two dates), construct dateRangeFilter and trigger search.
   */
  onFromDateChange(input: Date | string | null) {
    this.selectedFromDate = this.normalizeToDate(input);
    // Do not trigger search on From change — wait for To
  }

  // helper: convert NgbDateStruct -> Date (midnight)
  private structToDate(s: NgbDateStruct | null): Date | null {
    if (!s) return null;
    const dt = new Date(s.year, s.month - 1, s.day);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  /**
   * Return true when a given filter name is a date-type field
   */
  public isDateField(fieldName: string): boolean {
    if (!fieldName) {
      return false;
    }
    return this.DATE_FIELDS.includes(fieldName);
  }

  /**
   * Return true when a given filter name is a year-type field
   */
  public isYearField(fieldName: string): boolean {
    if (!fieldName) {
      return false;
    }
    return this.YEAR_FIELDS.includes(fieldName);
  }

  // Year range picker variables
  yearFrom: string | null = null;
  yearTo: string | null = null;
}
