import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditTrailModel } from './audit-trail.model';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';

@Injectable({ providedIn: 'root' })
export class AuditTrailService {
  private baseUrl = `${this.appConfig.rest.baseUrl}/api/audittrail`;
  private exportCSV = `${this.baseUrl}/export/csv/`;
  private exportPDF = this.baseUrl + '/export/pdf/';

  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) protected appConfig: AppConfig
  ) {}

  getAll(): Observable<AuditTrailModel[]> {
    return this.http.get<AuditTrailModel[]>(this.baseUrl);
  }

  getBasedOnDates(
    fromDate: string,
    toDate: string
  ): Observable<AuditTrailModel[]> {
    return this.http.get<AuditTrailModel[]>(
      `${this.baseUrl}/` + fromDate + '/to/' + toDate
    );
  }

  exportCsv(fromDate, toDate): Observable<Blob> {
    return this.http.get(`${this.exportCSV}${fromDate}/to/${toDate}`, {
      responseType: 'blob',
    });
  }

  exportPdf(fromDate, toDate): Observable<Blob> {
    return this.http.get(`${this.exportPDF}${fromDate}/to/${toDate}`, {
      responseType: 'blob',
    });
  }
}
