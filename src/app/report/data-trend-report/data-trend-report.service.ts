import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { ItemUploadInfo } from './data-trend.model';

@Injectable({
  providedIn: 'root',
})
export class DataTrendService {
  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) protected appConfig: AppConfig
  ) {}

  private baseURL = this.appConfig.rest.baseUrl + '/api';
  private dataTrendReportUrl = this.baseURL + '/datatrend';

  getTotalDataTrendReport(): Observable<ItemUploadInfo[]> {
    return this.http.get<ItemUploadInfo[]>(this.dataTrendReportUrl);
  }
}
