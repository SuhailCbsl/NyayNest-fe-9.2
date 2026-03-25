import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NgbDateParserFormatter,
  NgbDatepickerModule,
  NgbDateStruct,
  NgbPagination,
  NgbPaginationModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { NgbDateDdMmYyyyParserFormatter } from '../audit-trail-report/ngb-date-formatter';
import { DataUploadReportModel } from './data-upload.model';
import { firstValueFrom, Subscription } from 'rxjs';
import { DataUploadService } from './data-upload-report.service';
import { NotificationsService } from 'src/app/shared/notifications/notifications.service';
import { HttpClient } from '@angular/common/http';
import { TotalPageCountComponent } from './total-page-count/total-page-count.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ds-data-upload-report',
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    TotalPageCountComponent,
    NgbPaginationModule,
    NgbDatepickerModule,
  ],
  templateUrl: './data-upload-report.component.html',
  styleUrl: './data-upload-report.component.scss',
  providers: [
    {
      provide: NgbDateParserFormatter,
      useClass: NgbDateDdMmYyyyParserFormatter,
    },
  ],
})
export class DataUploadReportComponent {
  events: DataUploadReportModel[] = []; // items shown on current page (sliced from _allEvents)
  private _allEvents: DataUploadReportModel[] = []; // all data fetched once from backend

  totalResults = 0;
  resultsPerPage = 10;
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
  filteredEvents: DataUploadReportModel[] = [];
  private fetchSub: Subscription | null = null;
  @ViewChild('totalPageCount')
  totalPageCountComponent!: TotalPageCountComponent;
  totalPageCountList: any[] = [];
  isImportRunning = false;
  state: string;
  constructor(
    private dataUploadService: DataUploadService,
    private cdf: ChangeDetectorRef,
    private notificationService: NotificationsService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.getState();
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
        this.searchAuditData();
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
      const handle = e.handle ? String(e.handle).toLowerCase() : '';
      const itemId =
        e.itemId !== undefined && e.itemId !== null
          ? String(e.itemId).toLowerCase()
          : '';
      const lotNo = e.lotNo ? String(e.lotNo).toLowerCase() : '';
      const barcodeNo = e.barcodeNo ? String(e.barcodeNo).toLowerCase() : '';
      const dateOfUpload = e.dateOfUpload
        ? String(e.dateOfUpload).toLowerCase()
        : '';
      const pageCount = e.pageCount ? String(e.pageCount).toLowerCase() : '';
      const pdfCount = e.pdfCount ? String(e.pdfCount).toLowerCase() : '';
      const totalPageCount = e.totalFileCount
        ? String(e.totalFileCount).toLowerCase()
        : '';
      const mediaFileSize = e.mediaFileSize
        ? String(e.mediaFileSize).toLowerCase()
        : '';
      const typeOfFile = e.typeOfFile ? String(e.typeOfFile) : '';
      const deleteStatus = e.deleteStatus
        ? String(e.deleteStatus === true ? 'Yes' : 'No').toLowerCase()
        : '';
      const pdfA = e.pdfA
        ? String(e.pdfA === true ? 'Yes' : 'No').toLowerCase()
        : '';
      const hasDigitalSignatures = e.hasDigitalSignatures
        ? String(e.hasDigitalSignatures === true ? 'Yes' : 'No').toLowerCase()
        : '';
      const signee = e.signee ? String(e.signee).toLowerCase() : '';
      const signedAt = e.signedAt ? String(e.signedAt) : '';
      const collectionName = e.collectionName
        ? String(e.collectionName).toLowerCase()
        : '';
      const cnrNo = e.cnrNo ? String(e.cnrNo).toLowerCase() : '';

      return (
        handle.includes(search) ||
        itemId.includes(search) ||
        lotNo.includes(search) ||
        barcodeNo.includes(search) ||
        dateOfUpload.includes(search) ||
        pageCount.includes(search) ||
        pdfCount.includes(search) ||
        totalPageCount.includes(search) ||
        mediaFileSize.includes(search) ||
        typeOfFile.includes(search) ||
        deleteStatus.includes(search) ||
        pdfA.includes(search) ||
        hasDigitalSignatures.includes(search) ||
        signee.includes(search) ||
        signedAt.includes(search) ||
        collectionName.includes(search) ||
        cnrNo.includes(search)
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

    this.fetchSub = this.dataUploadService.getAllData().subscribe({
      next: (all: DataUploadReportModel[]) => {
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
        this.errorMessage = 'Failed to load data upload events';
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
    this.dataUploadService.exportCsv(this.fromDate, this.toDate).subscribe({
      next: (blob) => this.downloadFile(blob, 'data_upload.csv'),
      error: (err) => console.error('CSV export failed', err),
    });
    this.notificationService.success('Excel file downloaded successfully!');
  }

  exportPDF(): void {
    if (!this.fromDate || !this.toDate) {
      this.notificationService.error('Please select appropriate date!');
      return;
    }
    this.dataUploadService.exportPdf(this.fromDate, this.toDate).subscribe({
      next: (blob) => this.downloadFile(blob, 'data_upload.pdf'),
      error: (err) => console.error('PDF export failed', err),
    });
    this.notificationService.success('PDF downloaded successfully!');
  }

  // Optional: download current page as CSV client-side (quick local export)
  exportCurrentPageCsvClient(): void {
    if (!this.events || this.events.length === 0) return;

    const headers = [
      'handle',
      'itemId',
      'lotNo',
      'barcodeNo',
      'dateOfUpload',
      'pageCount',
      'pdfCount',
      'totalFileCount',
      'mediaFileSize',
      'typeOfFile',
      'deleteStatus',
      'pdfA',
      'hasDigitalSignature',
      'signee',
      'signedAt',
      'collectionName',
      'cnrNo',
    ];
    const lines = [headers.join(',')];

    this.events.forEach((e) => {
      const row = [
        this.csvEscape(e.handle),
        this.csvEscape(e.itemId),
        this.csvEscape(e.lotNo),
        this.csvEscape(e.barcodeNo),
        this.csvEscape(e.dateOfUpload),
        this.csvEscape(e.pageCount),
        this.csvEscape(e.pdfCount),
        this.csvEscape(e.totalFileCount),
        this.csvEscape(e.mediaFileSize),
        this.csvEscape(e.typeOfFile),
        this.csvEscape(e.deleteStatus),
        this.csvEscape(e.pdfA),
        this.csvEscape(e.hasDigitalSignatures),
        this.csvEscape(e.signee),
        this.csvEscape(e.signedAt),
        this.csvEscape(e.collectionName),
        this.csvEscape(e.cnrNo),
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

    this.fetchSub = this.dataUploadService
      .getRangeData(this.fromDate, this.toDate)
      .subscribe({
        next: (all: DataUploadReportModel[]) => {
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
  saveItemBulkUpload() {
    this.isImportRunning = true;
    this.dataUploadService.saveItemBulkUpload().subscribe({
      next: (response: any) => {
        this.isImportRunning = false;
        if (response) {
          console.log(response);
          this.searchAuditData();
          this.notificationService.success(
            'Recent Bulk Upload Viewed Successfully!',
          );
        } else {
          this.notificationService.error('No Recent Bulk Upload Found!');
        }
      },
      error: (error) => {
        this.isImportRunning = false;
        console.error('Error:', error);
        this.notificationService.error(
          error?.message || 'Failed to update scheduler!',
        );
      },
    });
  }
  async getState(): Promise<void> {
    const stateData = await firstValueFrom(
      this.http.get<{ state: string }>('assets/dynamicStateValue.json'),
    );
    this.state = stateData.state;
  }
}
