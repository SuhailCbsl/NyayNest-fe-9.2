import { Route } from '@angular/router';
import { AuditTrailReportComponent } from './audit-trail-report/audit-trail-report.component';
import { DataTrendReportComponent } from './data-trend-report/data-trend-report.component';
import { DataUploadReportComponent } from './data-upload-report/data-upload-report.component';

export const ROUTES: Route[] = [
  {
    path: '',
    children: [
      {
        path: 'audittrail',
        component: AuditTrailReportComponent,
        pathMatch: 'full',
      },
      {
        path: 'datatrend',
        component: DataTrendReportComponent,
        pathMatch: 'full',
      },
      {
        path: 'dataupload',
        component: DataUploadReportComponent,
        pathMatch: 'full',
      },
    ],
  },
];
