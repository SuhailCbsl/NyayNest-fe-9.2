import { Route } from '@angular/router';
import { AuditTrailReportComponent } from './audit-trail-report/audit-trail-report.component';
import { DataTrendReportComponent } from './data-trend-report/data-trend-report.component';
import { DataUploadReportComponent } from './data-upload-report/data-upload-report.component';
import { Breadcrumb } from '../breadcrumbs/breadcrumb/breadcrumb.model';
import { i18nBreadcrumbResolver } from '../core/breadcrumbs/i18n-breadcrumb.resolver';

export const ROUTES: Route[] = [
  {
    path: '',
    resolve: { Breadcrumb: i18nBreadcrumbResolver },
    data: {
      breadcrumbKey: 'reports',
      title: 'Reports',
    },
    children: [
      {
        path: 'audittrail',
        component: AuditTrailReportComponent,
        pathMatch: 'full',
        data: {
          breadcrumbKey: 'audittrailreports',
          title: 'Audit Trail Report',
        },
        resolve: { breadcrumb: i18nBreadcrumbResolver },
      },
      {
        path: 'datatrend',
        component: DataTrendReportComponent,
        pathMatch: 'full',
        data: { breadcrumbKey: 'datatrendreport', title: 'Data Trend Report' },
        resolve: { breadcrumb: i18nBreadcrumbResolver },
      },
      {
        path: 'dataupload',
        component: DataUploadReportComponent,
        pathMatch: 'full',
        data: {
          breadcrumbKey: 'datauploadreport',
          title: 'Data Upload Report',
        },
        resolve: { breadcrumb: i18nBreadcrumbResolver },
      },
    ],
  },
];
