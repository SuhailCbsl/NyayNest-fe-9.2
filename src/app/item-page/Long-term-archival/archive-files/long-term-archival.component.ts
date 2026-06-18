import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { LongTermArchivalService } from './long-term-archival.service';
import { NotificationsService } from 'src/app/shared/notifications/notifications.service';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
interface FilterTag {
  label: string;
  value: string;
  type: string;
  metaData_fieldId: string;
}

@Component({
  standalone: true,
  selector: 'ds-long-term-archival',
  templateUrl: './long-term-archival.component.html',
  styleUrls: ['./long-term-archival.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbDatepickerModule,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongTermArchivalComponent implements OnInit {
  archiveForm!: FormGroup;
  filters = [
    { key: 'CaseTypeName', label: 'Case Type Name' },
    { key: 'CaseYear', label: 'Case Year' },
    { key: 'CaseNature', label: 'Case Nature' },
    { key: 'CaseStatus', label: 'Case Status' },
    { key: 'orderJudgementDate', label: 'Judgment Date' },
    // { key: 'date', label: 'Last Accessed Date' },
  ];
  filterOptions: Record<string, string[]> = {
    CaseTypeName: [],
    CaseNature: [],
    CaseStatus: [],
    orderJudgementDate: [],
    // date: [],
  };
  caseYears: number[] = [];
  fileCount: number = 0;
  showPopup: boolean = false;
  isLoadingCaseTypes: boolean = false;
  judgmentDateModel: NgbDateStruct | null = null;
  lastAccessedModel: NgbDateStruct | null = null;
  judgmentDate: string | null = null; // backend string
  lastAccessed: string | null = null;
  filterTags: FilterTag[] = [];
  isLoading: boolean = false;
  loadingMessage: string = 'Retrieving Files';
  metadata_fieldId: any;
  yearList: number[] = [];
  showFromDropdown = false;
  showToDropdown = false;

  caseYearFrom: number | null = null;
  caseYearTo: number | null = null;
  fromSearchText: string = '';
  toSearchText: string = '';

  filteredFromYears: number[] = [];
  filteredToYears: number[] = [];
  months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  fullYearList: number[] = [];

  minDate = { year: 1900, month: 1, day: 1 };
  maxDate = { year: 2100, month: 12, day: 31 };
  get selectedFilter(): string {
    return this.archiveForm.get('filterBy')?.value;
  }
  get selectedFilterLabel(): string {
    return this.filters.find((f) => f.key === this.selectedFilter)?.label ?? '';
  }

  constructor(
    private fb: FormBuilder,
    private longTermArchivalService: LongTermArchivalService,
    private cdf: ChangeDetectorRef,
    private notificationService: NotificationsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.archiveForm = this.fb.group({
      filterBy: [''],
      CaseTypeName: [''],
      CaseYear: [''],
      orderJudgementDate: [''],
      CaseNature: [''],
      fromDate: [''],
      toDate: [''],
      CaseStatus: [''],
      date: [''],
      caseYearFrom: [''],
      caseYearTo: [''],

      judgmentFrom: [''],
      judgmentTo: [''],

      lastAccessedFrom: [''],
      lastAccessedTo: [''],
    });
    const currentYear = new Date().getFullYear();

    for (let y = 2100; y >= 1900; y--) {
      this.fullYearList.push(y);
    }
    const currentCaseYear = new Date().getFullYear();
    for (let i = currentCaseYear; i >= 1900; i--) {
      this.yearList.push(i);
    }
    // initial load
    this.filteredFromYears = [...this.yearList];
    this.filteredToYears = [...this.yearList];
    this.getAllMetadataFieldId();

    // this.archiveForm.get('filterBy')?.valueChanges.subscribe((value) => {
    //   this.clearOtherControls(value);
    //   if (value == 'caseTypeName' || value == 'caseNature' || value == 'caseStatus') {
    //     this.getDataForSelectedFilter(value);
    //   }
    // });
  }
  toIsoString(d: NgbDateStruct | null): string | null {
    return d
      ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(
          2,
          '0',
        )}`
      : null;
  }
  pad(n: number): string {
    return n < 10 ? '0' + n : n.toString();
  }

  toggleYearDropdown(type: string, event: Event) {
    event.stopPropagation();

    if (type === 'from') {
      this.showFromDropdown = !this.showFromDropdown;
      this.showToDropdown = false;

      this.fromSearchText = '';
      this.filteredFromYears = [...this.yearList];
    } else {
      this.showToDropdown = !this.showToDropdown;
      this.showFromDropdown = false;

      this.toSearchText = '';
      this.filteredToYears = [...this.yearList];
    }
  }

  selectYear(year: number, type: string, event: Event) {
    event.stopPropagation();

    // FROM YEAR SELECT
    if (type === 'from') {
      //  validation: From > To not allowed
      if (this.caseYearTo && year > this.caseYearTo) {
        alert('From Year cannot be greater than To Year');
        return;
      }

      this.caseYearFrom = year;

      //auto clear To if conflict (optional smart UX)
      if (this.caseYearTo && this.caseYearTo < year) {
        this.caseYearTo = null;
        this.archiveForm.patchValue({ caseYearTo: null });
      }

      this.archiveForm.patchValue({ caseYearFrom: year });
      this.showFromDropdown = false;
    }

    // TO YEAR SELECT
    else {
      // validation: To < From not allowed
      if (this.caseYearFrom && year < this.caseYearFrom) {
        this.notificationService.warning(
          'To Year cannot be less than From Year',
        );
        // alert('To Year cannot be less than From Year');
        return;
      }

      this.caseYearTo = year;

      this.archiveForm.patchValue({ caseYearTo: year });
      this.showToDropdown = false;
    }
  }

  filterYears(type: string) {
    if (type === 'from') {
      const search = (this.fromSearchText || '').trim();

      this.filteredFromYears = this.yearList.filter((y) =>
        y.toString().includes(search),
      );
    } else {
      const search = (this.toSearchText || '').trim();

      this.filteredToYears = this.yearList.filter((y) =>
        y.toString().includes(search),
      );
    }
  }
  trackByYear(index: number, item: number) {
    return item;
  }
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    this.showFromDropdown = false;
    this.showToDropdown = false;
  }
  onJudgmentDateSelect(picker: any, type: string) {
    // setTimeout(() => picker.close(), 100); // smooth close
    this.validateJudgmentDateRange(type);
  }
  validateJudgmentDateRange(type: string) {
    const from = this.archiveForm.get('judgmentFrom')?.value;
    const to = this.archiveForm.get('judgmentTo')?.value;

    if (from && to) {
      const fromDate = new Date(from.year, from.month - 1, from.day);
      ``;
      const toDate = new Date(to.year, to.month - 1, to.day);

      if (toDate < fromDate) {
        this.notificationService.warning(
          'To Date cannot be earlier than From Date',
        );

        // clear invalid value
        if (type === 'to') {
          this.archiveForm.patchValue({ judgmentTo: null });
        } else {
          this.archiveForm.patchValue({ judgmentFrom: null });
        }
      }
    }
    this.cdf.detectChanges();
  }
  onLastDateSelect(picker: any, type: string) {
    setTimeout(() => picker.close(), 100); // smooth close
    this.validateLastAccessed(type);
  }
  validateLastAccessed(type: string) {
    const from = this.archiveForm.get('lastAccessedFrom')?.value;
    const to = this.archiveForm.get('lastAccessedTo')?.value;

    if (from && to) {
      const fromDate = new Date(from.year, from.month - 1, from.day);
      const toDate = new Date(to.year, to.month - 1, to.day);

      if (toDate < fromDate) {
        this.notificationService.warning(
          'To Date cannot be earlier than From Date',
        );

        if (type === 'to') {
          this.archiveForm.patchValue({ lastAccessedTo: null });
        } else {
          this.archiveForm.patchValue({ lastAccessedFrom: null });
        }
      }
    }
    this.cdf.detectChanges();
  }
  getDataForSelectedFilter(filterKey: string) {
    this.onFilterChange();
    const jsonData = {
      filterBy: filterKey,
    };
    const label =
      this.filters.find((f) => f.key === filterKey)?.label ?? filterKey;
    this.longTermArchivalService.getDataForSelectedFilter(jsonData).subscribe(
      (response) => {
        if (response && response.status === 'OK') {
          if (!response.data || response.data.length === 0) {
            this.notificationService.error('Data not available for ' + label);
            return;
          }
          // this.metadata_fieldId = response.data[0].metadata_fieldId;
          if (filterKey === 'CaseTypeName') {
            this.filterOptions.CaseTypeName = response.data[0].dataList || [];
          } else if (filterKey === 'CaseYear') {
            this.caseYears = response.data[0].dataList || [];
          } else if (filterKey === 'orderJudgementDate') {
            this.filterOptions.orderJudgementDate =
              response.data[0].dataList || [];
          } else if (filterKey === 'date') {
            this.filterOptions.date = response.data[0].dataList || [];
          } else if (filterKey === 'CaseNature') {
            this.filterOptions.CaseNature = response.data[0].dataList || [];
          } else if (filterKey === 'CaseStatus') {
            this.filterOptions.CaseStatus = response.data[0].dataList || [];
          }
          this.cdf.markForCheck();
        } else {
          this.notificationService.error('Failed to load options for ' + label);
        }
      },
      (error) => {
        console.error('Error fetching case type names:', error);
        this.notificationService.error(
          error.error.error,
          'Failed to load ' + label + ' options',
        );
      },
    );
  }

  loadYears() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= 2000; i--) {
      this.caseYears.push(i);
    }
  }
  private clearOtherControls(selectedKey: string) {
    this.filters
      .map((filter) => filter.key)
      .filter((key) => key !== selectedKey)
      .forEach((key) => {
        if (this.archiveForm.contains(key)) {
          this.archiveForm.get(key)?.reset('');
        }
      });
  }

  // getCaseCount() {

  //   // if (this.archiveForm.invalid) {
  //   //   return;
  //   // }
  //   // const filterKey = this.selectedFilter;
  //   // if (!filterKey) {
  //   //   this.notificationService.warning('Please select a filter to add');
  //   //   return '';
  //   // }
  //   // const value = this.archiveForm.get(filterKey)?.value;
  //   // if (value === null || value === '') {
  //   //   this.notificationService.warning('Please select a value for the chosen filter.');
  //   //   return;
  //   // }
  //   if (this.filterTags.length == 0) {
  //     this.notificationService.warning("please add filter first.");
  //     return;
  //   }
  //   // const label = this.filters.find((f) => f.key === filterKey)?.label ?? filterKey;
  //   // backend API call here
  //   const jsonData = {
  //     // filter_value: value,
  //     // filter_key: filterKey,
  //     filterTags: this.filterTags,
  //     // filter_element_value: this.metadata_fieldId
  //   };
  //   this.longTermArchivalService.getCountSelectedFilter(jsonData).subscribe(
  //     (response) => {
  //       if (response && response.status === 'OK') {
  //         if (!response.count || response.count.length === 0) {
  //           this.notificationService.error('Data not available for selected filter');
  //           return;
  //         }
  //         // this.fileCount = Math.floor(Math.random() * 200) + 10;
  //         this.fileCount = response.count.count || 0;
  //         this.showPopup = true;
  //         this.cdf.markForCheck();
  //       } else {
  //         this.notificationService.error('Failed to get total count for selected filter');
  //       }
  //     },
  //     (error) => {
  //       console.error('Error fetching case type names:', error);
  //       this.notificationService.error(error.error.error, 'Failed to get total count for selected filter options');
  //     }
  //   );
  // }

  getCaseCount() {
    if (this.filterTags.length === 0) {
      this.notificationService.warning('please add filter first.');
      return;
    }

    const payload = {
      filterTags: this.filterTags,
    };

    this.longTermArchivalService.getCount(payload).subscribe({
      next: (res) => {
        if (res?.status === 'OK') {
          this.fileCount = res.count || 0;
          this.showPopup = true;
          this.cdf.markForCheck();
        } else {
          this.notificationService.error('Failed to get count');
        }
      },
      error: () => {
        this.notificationService.error('Error fetching count');
      },
    });
  }

  archiveFiles() {
    if (this.fileCount === 0) {
      this.notificationService.warning(
        'No files to archive for selected filter',
      );
      return;
    }

    const jsonData = {
      filterTags: this.filterTags,
    };

    //STEP 1: Close confirmation popup
    this.showPopup = false;

    //STEP 2: Show loader
    this.isLoading = true;
    this.loadingMessage = 'Retrieving Files';

    this.longTermArchivalService.completeArchiveCase(jsonData).subscribe(
      (response) => {
        // STOP loader
        this.isLoading = false;

        if (response && response.status === 'OK') {
          this.notificationService.success(
            'Files archived successfully for selected filter',
            'Total Processed: ' +
              response.totalProcessed +
              ', Total Failed: ' +
              response.totalFailed +
              ', Total Success: ' +
              response.totalSuccess,
          );
          this.router.navigate(['/longtermarchival', 'allarchivedfiles']);
          this.cdf.markForCheck();
        } else {
          this.notificationService.error(
            'Failed to archive files for selected filter',
          );
        }
        this.cdf.detectChanges();
      },
      (error) => {
        // STOP loader
        this.isLoading = false;

        console.error('Error:', error);
        this.notificationService.error(
          error?.error?.message || 'Something went wrong',
          'Failed to archive files for selected filter',
        );
        this.cdf.detectChanges();
      },
    );
  }
  getSelectedFilterValue(): string {
    debugger;
    const filterKey = this.selectedFilter;
    if (!filterKey) {
      return '';
    }
    var value;
    // HANDLE DIFFERENT TYPES
    if (filterKey === 'CaseYear') {
      if (!this.caseYearFrom || !this.caseYearTo) {
        this.notificationService.warning('Please select both From and To year');
        return;
      }
      value = `${this.caseYearFrom} to ${this.caseYearTo}`;
    } else if (filterKey === 'orderJudgementDate') {
      const from = this.archiveForm.get('judgmentFrom')?.value;
      const to = this.archiveForm.get('judgmentTo')?.value;

      if (!from || !to) {
        this.notificationService.warning('Please select both dates');
        return;
      }

      value = `${this.toIsoString(from)} to ${this.toIsoString(to)}`;
    } else if (filterKey === 'date') {
      const from = this.archiveForm.get('lastAccessedFrom')?.value;
      const to = this.archiveForm.get('lastAccessedTo')?.value;

      if (!from || !to) {
        this.notificationService.warning('Please select both dates');
        return;
      }

      value = `${this.toIsoString(from)} to ${this.toIsoString(to)}`;
    } else {
      value = this.archiveForm.get(filterKey)?.value;
      if (!value) {
        this.notificationService.warning('Please select a value');
        return;
      }
    }
    return value ? String(value) : '';
  }
  onFilterChange() {
    this.caseYearFrom = null;
    this.caseYearTo = null;

    // reset form
    this.archiveForm.patchValue({
      caseYearFrom: null,
      caseYearTo: null,
      judgmentFrom: null,
      judgmentTo: null,
      lastAccessedFrom: null,
      lastAccessedTo: null,
    });

    // close dropdowns
    this.showFromDropdown = false;
    this.showToDropdown = false;
  }
  addFilterTag() {
    const filterKey = this.selectedFilter;
    if (!filterKey) {
      this.notificationService.warning('Please select a filter to add');
      return;
    }

    let value = '';

    // HANDLE DIFFERENT TYPES
    if (filterKey === 'CaseYear') {
      if (!this.caseYearFrom || !this.caseYearTo) {
        this.notificationService.warning('Please select both From and To year');
        return;
      }
      value = `${this.caseYearFrom} to ${this.caseYearTo}`;
    } else if (filterKey === 'orderJudgementDate') {
      const from = this.archiveForm.get('judgmentFrom')?.value;
      const to = this.archiveForm.get('judgmentTo')?.value;

      if (!from || !to) {
        this.notificationService.warning('Please select both dates');
        return;
      }

      value = `${this.toIsoString(from)} to ${this.toIsoString(to)}`;
    } else if (filterKey === 'date') {
      const from = this.archiveForm.get('lastAccessedFrom')?.value;
      const to = this.archiveForm.get('lastAccessedTo')?.value;

      if (!from || !to) {
        this.notificationService.warning('Please select both dates');
        return;
      }

      value = `${this.toIsoString(from)} to ${this.toIsoString(to)}`;
    } else {
      value = this.archiveForm.get(filterKey)?.value;
      if (!value) {
        this.notificationService.warning('Please select a value');
        return;
      }
    }

    const label = this.selectedFilterLabel;
    const metaData_fieldId =
      this.metadata_fieldId?.find(
        (m: any) =>
          m?.element?.toLowerCase().trim() === filterKey?.toLowerCase().trim(),
      )?.metadata_field_id ?? '';

    const metaData_element =
      this.metadata_fieldId?.find(
        (m: any) =>
          m?.element?.toLowerCase().trim() === filterKey?.toLowerCase().trim(),
      )?.element ?? '';
    // PREVENT DUPLICATE FILTER TYPE
    const exists = this.filterTags.some((t) => t.type === filterKey);
    if (exists) {
      this.notificationService.warning('Filter already added');
      return;
    }

    this.filterTags.push({
      label,
      value,
      type: metaData_element,
      metaData_fieldId: metaData_fieldId,
    });

    // RESET CURRENT SELECTION (important UX)
    // this.archiveForm.patchValue({
    //   filterBy: '',
    // });
  }
  removeFilterTag(index: number) {
    this.filterTags.splice(index, 1);
  }
  resetAll() {
    // Reset entire form
    this.archiveForm.reset();

    // Clear selected filter
    this.archiveForm.patchValue({
      filterBy: '',
    });

    // Clear year selections
    this.caseYearFrom = null;
    this.caseYearTo = null;

    // Clear dropdowns
    this.showFromDropdown = false;
    this.showToDropdown = false;

    // Clear filter tags
    this.filterTags = [];

    // Optional: reset date pickers
    this.archiveForm.patchValue({
      judgmentFrom: null,
      judgmentTo: null,
      lastAccessedFrom: null,
      lastAccessedTo: null,
    });

    // Trigger UI update (important for OnPush)
    this.cdf.markForCheck();
  }
  // getAllMetadataFieldId() {
  //   debugger;
  //   this.longTermArchivalService.getAllMetadataFieldId().subscribe(
  //     (response) => {
  //       if (response && response.status === 'OK') {
  //         this.metadata_fieldId = response.data || [];
  //       }
  //     },
  //     (error) => {
  //       this.notificationService.error(
  //         error?.error?.message || 'Something went wrong', 'Failed to get metadatfieldID.'
  //       );
  //     }
  //   );
  // }
  getAllMetadataFieldId() {
    this.longTermArchivalService.getAllMetadataFieldId().subscribe(
      (response) => {
        if (response && response.status === 'OK') {
          console.log('SUBSCRIBE HIT', response);
          this.metadata_fieldId = response.res || [];
          this.archiveForm.get('filterBy')?.valueChanges.subscribe((value) => {
            this.clearOtherControls(value);
            if (
              value == 'CaseTypeName' ||
              value == 'CaseNature' ||
              value == 'CaseStatus'
            ) {
              this.getDataForSelectedFilter(value);
            }
          });
        }
      },
      (error) => {
        this.notificationService.error(
          error?.error?.message || 'Something went wrong',
          'Failed to get metadatfieldID.',
        );
      },
    );
  }
}
