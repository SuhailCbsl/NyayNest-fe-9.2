import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';

@Injectable({
  providedIn: 'root'
})
export class LongTermArchivalService {
  private readonly baseUrl: string;
  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) private appConfig: AppConfig
  ) {
    // Ensure no trailing slash on base, then append our resource path
    const base = (this.appConfig.rest.baseUrl || '').replace(/\/+$/, '');
    this.baseUrl = `${base}/api/long-term-archival`;
  }
  getDataForSelectedFilter(jsonData): Observable<any> {
    return this.http.post(this.baseUrl + '/get-data-selected-filter', { jsonData: jsonData });
  }
  getCountSelectedFilter(jsonData): Observable<any> {
    return this.http.post(this.baseUrl + '/get-count-selected-filter', { jsonData: jsonData });
  }
  completeArchiveCase(jsonData): Observable<any> {
    return this.http.post(this.baseUrl + '/archive-item', { jsonData: jsonData });
  }
  getAllMetadataFieldId(): Observable<any> {
    return this.http.get(this.baseUrl + '/get-metadata-fieldID');
  }
  getCount(data: any) {
    return this.http.post<any>(this.baseUrl +'/count', data);
  }
}
