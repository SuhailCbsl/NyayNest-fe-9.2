import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { DataUploadReportModel } from './data-upload.model';

@Injectable({ providedIn: 'root' })
export class DataUploadService {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) private appConfig: AppConfig
  ) {
    // Ensure no trailing slash on base, then append our resource path
    const base = (this.appConfig.rest.baseUrl || '').replace(/\/+$/, '');
    this.baseUrl = `${base}/api/dataupload`;
  }

  /** 0) Fetch ALL data initially */
  getAllData(): Observable<DataUploadReportModel[]> {
    return this.http.get<DataUploadReportModel[]>(this.baseUrl);
  }

  /** 1) Fetch data by date range (yyyy-MM-dd) */
  getRangeData(
    fromDate: string,
    toDate: string
  ): Observable<DataUploadReportModel[]> {
    const from = encodeURIComponent(fromDate);
    const to = encodeURIComponent(toDate);
    return this.http.get<DataUploadReportModel[]>(
      `${this.baseUrl}/${from}/to/${to}`
    );
  }

  /** 2) Export ENTIRE dataset as CSV */
  exportCsvAll(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/csv`, {
      responseType: 'blob',
      headers: new HttpHeaders({ Accept: 'text/csv' }),
    });
  }

  /** 3) Export ENTIRE dataset as PDF */
  exportPdfAll(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/pdf`, {
      responseType: 'blob',
      headers: new HttpHeaders({ Accept: 'application/pdf' }),
    });
  }

  /** 4) Export RANGE as CSV (yyyy-MM-dd) */
  exportCsv(fromDate: string, toDate: string): Observable<Blob> {
    const from = encodeURIComponent(fromDate);
    const to = encodeURIComponent(toDate);
    return this.http.get(`${this.baseUrl}/${from}/to/${to}/csv`, {
      responseType: 'blob',
      headers: new HttpHeaders({ Accept: 'text/csv' }),
    });
  }

  /** 5) Export RANGE as PDF (yyyy-MM-dd) */
  exportPdf(fromDate: string, toDate: string): Observable<Blob> {
    const from = encodeURIComponent(fromDate);
    const to = encodeURIComponent(toDate);
    return this.http.get(`${this.baseUrl}/${from}/to/${to}/pdf`, {
      responseType: 'blob',
      headers: new HttpHeaders({ Accept: 'application/pdf' }),
    });
  }

  /** Helper: trigger browser download from a Blob */
  saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  updateSchedulerStatus(enabled: boolean): Observable<any> {
    const payload = { schedulerEnabled: enabled };
    return this.http.post(this.baseUrl + '/status', payload);
  }

  saveItemBulkUpload(): Observable<any> {
    return this.http.get(this.baseUrl + '/saveitembulkupload');
  }
  getTotalPageCount(): Observable<any> {
    return this.http.get(this.baseUrl + '/total-page-count');
  }
}
