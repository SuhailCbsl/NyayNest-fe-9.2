import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';

@Injectable({
  providedIn: 'root'
})
export class WorkflowBatchImportService {
  private readonly baseUrl: string;
  private readonly baseUrlForAudioVideo: string;
  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) private appConfig: AppConfig
  ) {
    // Ensure no trailing slash on base, then append our resource path
    const base = (this.appConfig.rest.baseUrl || '').replace(/\/+$/, '');
    this.baseUrl = `${base}/api/workflow`;
    this.baseUrlForAudioVideo = `${base}/api/audiovideo`;
  }
  saveWorkFlowData(jsonData): Observable<any> {
    const payload = { jsonData };
    return this.http.post(this.baseUrl + '/run-python', payload);
  }
  checkDuplicateFileBarCode(jsonData): Observable<any> {
    const payload = { jsonData };
    return this.http.post(this.baseUrl + '/duplicate-barcode', payload);
  }
  uploadAudio(audioBlob: Blob): Observable<any> {
    debugger
    const formData = new FormData();
    formData.append('file', audioBlob, 'recorded_audio.webm');

    return this.http.post(this.baseUrlForAudioVideo + '/audiovideoupload', formData);
  }
}
