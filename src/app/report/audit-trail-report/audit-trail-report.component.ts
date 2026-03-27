import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NgbDateParserFormatter,
  NgbDatepickerModule,
  NgbDateStruct,
  NgbDropdownModule,
  NgbPaginationModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { NgbDateDdMmYyyyParserFormatter } from './ngb-date-formatter';
import { AuditTrailModel } from './audit-trail.model';
import { Subscription } from 'rxjs';
import { AuditTrailService } from './audit-trail.service';
import { NotificationsService } from 'src/app/shared/notifications/notifications.service';

@Component({
  selector: 'ds-audit-trail-report',
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    NgbPaginationModule,
    NgbDatepickerModule,
    NgbDropdownModule,
  ],
  templateUrl: './audit-trail-report.component.html',
  styleUrl: './audit-trail-report.component.scss',
  providers: [
    {
      provide: NgbDateParserFormatter,
      useClass: NgbDateDdMmYyyyParserFormatter,
    },
  ],
})
export class AuditTrailReportComponent {
  events: AuditTrailModel[] = []; // items shown on current page (sliced from _allEvents)
  private _allEvents: AuditTrailModel[] = []; // all data fetched once from backend

  totalResults = 0;
  resultsPerPage = 50;
  currentPage = 1;

  isLoading = false;
  errorMessage: string | null = null;

  fromDateModel: NgbDateStruct | null = null;
  toDateModel: NgbDateStruct | null = null;

  fromDate: string | null = null; // backend string
  toDate: string | null = null;

  checkReset: boolean;
  dateError: string | null = null;
  searchText: string = '';
  filteredEvents: AuditTrailModel[] = [];
  private fetchSub: Subscription | null = null;

  constructor(
    private auditService: AuditTrailService,
    private cdf: ChangeDetectorRef,
    private notificationService: NotificationsService,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 2);

    this.toDateModel = {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    };
    this.toDate = this.toIsoString(this.toDateModel);

    this.fromDateModel = {
      year: lastWeek.getFullYear(),
      month: lastWeek.getMonth() + 1,
      day: lastWeek.getDate(),
    };
    this.fromDate = this.toIsoString(this.fromDateModel);

    this.searchAuditData();
  }

  toIsoString(d: NgbDateStruct | null): string | null {
    return d
      ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(
          2,
          '0',
        )}`
      : null;
  }

  validateDates() {
    if (this.fromDate && this.toDate) {
      const from = new Date(this.fromDate);
      const to = new Date(this.toDate);
      if (to < from) {
        this.toDateModel = null;
        this.cdf.detectChanges();
        this.notificationService.info(
          'To date should be greater than From date!',
        );

        this.resetCalendar();
        this.cdf.detectChanges();
        return;
      } else {
        this.cdf.detectChanges();
        this.dateError = null;
      }
    } else {
      this.cdf.detectChanges();
      this.dateError = null;
    }
  }

  onFromDateSelect(date: NgbDateStruct) {
    this.fromDateModel = date; // UI bind ke liye
    this.fromDate = this.toIsoString(this.fromDateModel); // string backend ke liye
    this.validateDates();
    this.cdf.detectChanges(); // force change detection
  }

  onToDateSelect(date: NgbDateStruct) {
    this.toDateModel = date;
    this.toDate = this.toIsoString(this.toDateModel);
    this.validateDates();
    this.cdf.detectChanges();
  }

  applyFilter(): void {
    const search = (this.searchText || '').toLowerCase().trim();
    if (!search) {
      // restore current dataset (which may be date-filtered)
      this.filteredEvents = [...this._allEvents];
      this.currentPage = 1;
      this.updateResults();
      return;
    }

    this.filteredEvents = this._allEvents.filter((e) => {
      const userName = e.userName ? String(e.userName).toLowerCase() : '';
      const userId =
        e.userId !== undefined && e.userId !== null
          ? String(e.userId).toLowerCase()
          : '';
      const action = e.action ? String(e.action).toLowerCase() : '';
      const eventTime = e.eventTime ? String(e.eventTime).toLowerCase() : '';
      const handle = e.handle ? String(e.handle).toLowerCase() : '';
      const url = e.url ? String(e.url).toLowerCase() : '';

      return (
        userName.includes(search) ||
        userId.includes(search) ||
        action.includes(search) ||
        eventTime.includes(search) ||
        handle.includes(search) ||
        url.includes(search)
      );
    });

    this.currentPage = 1;
    this.updateResults();
  }

  private loadAllEvents(): void {
    if (this.fetchSub) {
      this.fetchSub.unsubscribe();
      this.fetchSub = null;
    }

    // immediate UI reset so user doesn't see mixed rows
    this.isLoading = true;
    this.errorMessage = null;
    this.filteredEvents = [];
    this.events = [];
    this.totalResults = 0;
    this.currentPage = 1;
    this.cdf.detectChanges();

    this.fetchSub = this.auditService.getAll().subscribe({
      next: (all: AuditTrailModel[]) => {
        this._allEvents = Array.isArray(all) ? all : [];
        // replace filteredEvents with fresh data
        this.filteredEvents = [...this._allEvents];
        this.totalResults = this.filteredEvents.length;
        this.currentPage = 1;
        this.updateResults();
        this.isLoading = false;
        this.cdf.detectChanges();
        // clear subscription handle
        if (this.fetchSub) {
          this.fetchSub.unsubscribe();
          this.fetchSub = null;
        }
      },
      error: (err) => {
        console.error('Failed to load audit events', err);
        this.errorMessage = 'Failed to load audit events';
        this._allEvents = [];
        this.filteredEvents = [];
        this.events = [];
        this.totalResults = 0;
        this.isLoading = false;
        this.cdf.detectChanges();
        if (this.fetchSub) {
          this.fetchSub.unsubscribe();
          this.fetchSub = null;
        }
      },
    });
  }

  // Called when user clicks a page number (ngb-pagination)
  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.updateResults();
  }

  // compute slice for current page
  updateResults(): void {
    if (!this.filteredEvents || this.filteredEvents.length === 0) {
      this.events = [];
      this.totalResults = 0;
      return;
    }

    const start = (this.currentPage - 1) * this.resultsPerPage;
    const end = start + this.resultsPerPage;
    this.events = this.filteredEvents.slice(start, end); // slice filteredEvents
    this.totalResults = this.filteredEvents.length;
  }

  // safe helper (used by template)
  handleDisplay(handle?: string | null): string {
    return handle === null || handle === undefined || handle === ''
      ? '-'
      : handle;
  }

  // Server-side export endpoints (unchanged)
  exportCSV(): void {
    if (!this.fromDate || !this.toDate) {
      this.notificationService.error('Please select appropriate date!');
      return;
    }
    this.auditService.exportCsv(this.fromDate, this.toDate).subscribe({
      next: (blob) => this.downloadFile(blob, 'audit_report.csv'),
      error: (err) => console.error('CSV export failed', err),
    });
    this.notificationService.success('Excel file downloaded successfully!');
  }

  exportPDF(): void {
    if (!this.fromDate || !this.toDate) {
      this.notificationService.error('Please select appropriate date!');
      return;
    }
    this.auditService.exportPdf(this.fromDate, this.toDate).subscribe({
      next: (blob) => this.downloadFile(blob, 'audit_report.pdf'),
      error: (err) => console.error('PDF export failed', err),
    });
    this.notificationService.success('PDF downloaded successfully!');
  }

  // Optional: download current page as CSV client-side (quick local export)
  exportCurrentPageCsvClient(): void {
    if (!this.events || this.events.length === 0) return;

    const headers = [
      'userName',
      'userId',
      'action',
      'eventTime',
      'handle',
      'url',
      'ipAddress',
      'detail',
    ];
    const lines = [headers.join(',')];

    this.events.forEach((e) => {
      const row = [
        this.csvEscape(e.userName),
        this.csvEscape(e.userId),
        this.csvEscape(e.action),
        this.csvEscape(e.eventTime),
        this.csvEscape(e.handle),
        this.csvEscape(e.url),
        this.csvEscape(e.ipAddresses),
        this.csvEscape(e.detail),
      ];
      lines.push(row.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    this.downloadFile(blob, `audit_report_page_${this.currentPage}.csv`);
  }

  // helper to download a Blob
  private downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  private csvEscape(value: any): string {
    if (value == null) return '';
    let s = String(value);
    s = s.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/"/g, '""'); // sanitize
    // if contains comma, newline or double-quote, wrap with quotes
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  }

  searchAuditData() {
    if (!this.fromDate || !this.toDate) {
      this.notificationService.error(
        'Please Select From and To date for getting data!',
      );
      return;
    }

    // cancel any previous request
    if (this.fetchSub) {
      this.fetchSub.unsubscribe();
      this.fetchSub = null;
    }

    this.isLoading = true;
    this.errorMessage = null;
    // clear UI immediately to avoid mixing old rows
    this.filteredEvents = [];
    this.events = [];
    this.totalResults = 0;
    this.currentPage = 1;
    this.cdf.detectChanges();

    this.fetchSub = this.auditService
      .getBasedOnDates(this.fromDate, this.toDate)
      .subscribe({
        next: (all: AuditTrailModel[]) => {
          this._allEvents = Array.isArray(all) ? all : [];
          this.filteredEvents = [...this._allEvents];
          this.totalResults = this.filteredEvents.length;
          this.currentPage = 1;
          this.updateResults();
          this.isLoading = false;
          this.cdf.detectChanges();
          if (this.fetchSub) {
            this.fetchSub.unsubscribe();
            this.fetchSub = null;
          }
        },
        error: (err) => {
          console.error('Failed to load audit events', err);
          this.notificationService.error('Failed to load audit events');
          this.errorMessage = 'Failed to load audit events';
          this._allEvents = [];
          this.filteredEvents = [];
          this.events = [];
          this.totalResults = 0;
          this.isLoading = false;
          this.cdf.detectChanges();
          if (this.fetchSub) {
            this.fetchSub.unsubscribe();
            this.fetchSub = null;
          }
        },
      });
  }

  resetCalendar() {
    // compute today and 2 days ago
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 2);

    // update UI models
    this.fromDateModel = {
      year: from.getFullYear(),
      month: from.getMonth() + 1,
      day: from.getDate(),
    };
    this.toDateModel = {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    };

    // update backend strings
    this.fromDate = this.toIsoString(this.fromDateModel);
    this.toDate = this.toIsoString(this.toDateModel);

    // clear extras and reset paging
    this.searchText = '';
    this.dateError = null;
    this.currentPage = 1;

    this.cdf.detectChanges();

    // fetch last 2 days again
    this.searchAuditData();
  }
}
