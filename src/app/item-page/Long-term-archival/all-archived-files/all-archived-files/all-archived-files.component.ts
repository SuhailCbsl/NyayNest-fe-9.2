import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';

import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

import { NotificationsService } from 'src/app/shared/notifications/notifications.service';

import { AllArchivedFilesService } from './all-archived-files.service';
import { CommonModule } from '@angular/common';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

export interface ArchivedCase {
  itemId: string;

  caseNo: string;

  caseType: string;

  cnrNumber: string;

  case_year: string;

  case_nature: string;

  case_status: string;

  retain: boolean;

  isArchive: boolean;

  archiveDateTime: string;
}

export interface ArchivedCasePagination {
  content: ArchivedCase[];

  totalElements: number;

  totalPages: number;

  page: number;

  size: number;
}

@Component({
  standalone: true,
  selector: 'ds-all-archived-files',
  templateUrl: './all-archived-files.component.html',
  styleUrls: ['./all-archived-files.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbPaginationModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllArchivedFilesComponent implements OnInit, OnDestroy {
  cases: ArchivedCase[] = [];

  isLoading = false;

  currentPage = 1;

  pageSize = 20;

  totalElements = 0;

  totalPages = 0;

  // lastArchiveDate = '';

  hasMoreData = true;

  @ViewChild('dateFilterWrap', { static: false })
  dateFilterWrap?: ElementRef<HTMLDivElement>;

  searchControl = new FormControl('');

  dateFromControl = new FormControl('');

  dateToControl = new FormControl('');

  appliedDateFrom = '';

  appliedDateTo = '';

  dateFilterError = '';

  showDateFilter = false;

  selectedIds = new Set<string>();

  private destroy$ = new Subject<void>();
  isLoadingShow: boolean = false;

  constructor(
    private archivalService: AllArchivedFilesService,
    private notificationService: NotificationsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadCases();

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.resetAndLoad();
      });
  }

  loadCases(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    this.cdr.markForCheck();

    this.archivalService
      .getArchivedItems(
        this.currentPage - 1,
        this.pageSize,
        this.searchControl.value,
        this.appliedDateFrom,
        this.appliedDateTo,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response || [];

          this.selectedIds.clear();

          this.cases = response.content || [];

          this.totalElements = response.totalElements || 0;

          this.totalPages = response.totalPages || 0;

          this.isLoading = false;

          this.cdr.markForCheck();
        },

        error: () => {
          this.isLoading = false;

          this.notificationService.error(
            null,
            'Unable to load archive records',
          );

          this.cdr.markForCheck();
        },
      });
  }

  // resetAndLoad(): void {

  //   this.cases = [];

  //   this.lastArchiveDate = '';

  //   this.hasMoreData = true;

  //   this.loadCases();
  // }

  resetAndLoad(): void {
    this.currentPage = 0;

    this.cases = [];

    this.hasMoreData = true;

    this.loadCases();
  }

  toggleCase(itemId: string): void {
    if (this.selectedIds.has(itemId)) {
      this.selectedIds.delete(itemId);
    } else {
      this.selectedIds.add(itemId);
    }
  }

  isSelected(itemId: string): boolean {
    return this.selectedIds.has(itemId);
  }

  toggleDateFilter(): void {
    this.showDateFilter = !this.showDateFilter;

    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.showDateFilter || !this.dateFilterWrap?.nativeElement) {
      return;
    }

    if (!this.dateFilterWrap.nativeElement.contains(event.target as Node)) {
      this.showDateFilter = false;

      this.cdr.markForCheck();
    }
  }

  applyDateFilter(): void {
    this.dateFilterError = '';

    const from = this.dateFromControl.value;

    const to = this.dateToControl.value;

    // FLEXIBLE FILTERING
    if (from && to && from > to) {
      this.dateFilterError = 'From date must be earlier than To date';

      return;
    }

    this.appliedDateFrom = from || '';

    this.appliedDateTo = to || '';

    this.showDateFilter = false;

    this.resetAndLoad();
  }

  clearDateFilter(): void {
    this.dateFromControl.setValue('');

    this.dateToControl.setValue('');

    this.appliedDateFrom = '';

    this.appliedDateTo = '';

    this.dateFilterError = '';

    this.showDateFilter = false;

    this.resetAndLoad();
  }

  get hasActiveDateFilter(): boolean {
    return !!(this.appliedDateFrom || this.appliedDateTo);
  }

  trackById(index: number, item: ArchivedCase): string {
    return item.itemId;
  }

  onPageChange(page: number): void {
    this.currentPage = page;

    this.loadCases();
  }

  onPageSizeChange(): void {
    this.currentPage = 0;

    this.loadCases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();

    this.destroy$.complete();
  }

  get allOnPageSelected(): boolean {
    return (
      this.cases.length > 0 &&
      this.cases.every((item) => this.selectedIds.has(item.itemId))
    );
  }

  get someOnPageSelected(): boolean {
    return this.selectedIds.size > 0 && !this.allOnPageSelected;
  }
  toggleSelectAll(): void {
    if (this.allOnPageSelected) {
      this.cases.forEach((item) => {
        this.selectedIds.delete(item.itemId);
      });
    } else {
      this.cases.forEach((item) => {
        this.selectedIds.add(item.itemId);
      });
    }

    this.cdr.markForCheck();
  }
  restoreSelected(): void {
    if (this.selectedIds.size === 0) {
      return;
    }

    this.isLoadingShow = true;

    const idsToRestore = Array.from(this.selectedIds);

    this.archivalService
      .restoreItems(idsToRestore)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: string) => {
          console.log(response);

          this.selectedIds.clear();

          this.totalElements = this.totalElements - idsToRestore.length;
          this.loadCases();
          this.notificationService.success(null, 'Items restored successfully');

          this.isLoadingShow = false;

          this.cdr.markForCheck();
        },

        error: (error) => {
          console.error(error);

          this.isLoadingShow = false;

          this.notificationService.error(
            null,
            'Unable to restore selected items',
          );

          this.loadCases();
          this.cdr.markForCheck();
        },
      });
  }
}
