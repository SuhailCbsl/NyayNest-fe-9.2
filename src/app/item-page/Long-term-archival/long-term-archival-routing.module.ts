import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LongTermArchivalComponent } from './archive-files/long-term-archival.component';
import { AllArchivedFilesComponent } from './all-archived-files/all-archived-files/all-archived-files.component';
import { i18nBreadcrumbResolver } from 'src/app/core/breadcrumbs/i18n-breadcrumb.resolver';

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumbDisabled: true,
    },
    children: [
      {
        path: 'archivefiles',
        component: LongTermArchivalComponent,
        data: {
          breadcrumbKey: 'archivefiles',
          title: 'Archive Files',
        },
        resolve: { breadcrumb: i18nBreadcrumbResolver },
      },
      {
        path: 'allarchivedfiles',
        component: AllArchivedFilesComponent,
        data: {
          breadcrumbKey: 'allarchivedfiles',
          title: 'All Archived Files',
        },
        resolve: { breadcrumb: i18nBreadcrumbResolver },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LongTermArchivalRoutingModule {}
