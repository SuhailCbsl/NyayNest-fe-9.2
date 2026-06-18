import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  Inject,
  Injectable
} from '@angular/core';

import {
  Observable
} from 'rxjs';

import {
  APP_CONFIG,
  AppConfig
} from 'src/config/app-config.interface';
import { ArchivedCase, ArchivedCasePagination } from './all-archived-files.component';

@Injectable({
  providedIn: 'root'
})
export class AllArchivedFilesService {

  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG)
    private appConfig: AppConfig
  ) {

    const base =
      (this.appConfig.rest.baseUrl || '')
        .replace(/\/+$/, '');

    this.baseUrl =
      `${base}/api/all-archived-files`;
  }

  // getArchivedItems(

  //   size: number,

  //   search?: string,

  //   dateFrom?: string,

  //   dateTo?: string,

  //   lastArchiveDate?: string

  // ): Observable<any> {

  //   let params =
  //     new HttpParams()
  //     .set(
  //       'size',
  //       size.toString()
  //     );

  //   // SEARCH
  //   if (
  //     search &&
  //     search.trim()
  //   ) {

  //     params = params.set(
  //       'search',
  //       search.trim()
  //     );
  //   }

  //   // FROM DATE
  //   if (dateFrom) {

  //     params = params.set(
  //       'dateFrom',
  //       dateFrom
  //     );
  //   }

  //   // TO DATE
  //   if (dateTo) {

  //     params = params.set(
  //       'dateTo',
  //       dateTo
  //     );
  //   }

  //   // CURSOR
  //   if (lastArchiveDate) {

  //     params = params.set(
  //       'lastArchiveDate',
  //       lastArchiveDate
  //     );
  //   }

  //   return this.http.get<any>(
  //     `${this.baseUrl}/items`,
  //     { params }
  //   );
  // }

  getArchivedItems(
    page: number,
    size: number,
    search?: string,
    dateFrom?: string,
    dateTo?: string
  ) {

    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (search) {
      params = params.set('search', search);
    }

    if (dateFrom) {
      params = params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params = params.set('dateTo', dateTo);
    }

    return this.http.get<ArchivedCasePagination>(
      `${this.baseUrl}/items`,
      { params }
    );
  }

  restoreItems(
    itemIds: string[]
  ): Observable<any> {

    return this.http.post<any>(
      `${this.baseUrl}/restore`,
      { itemIds }
    );
  }
}