import { Route } from '@angular/router';
import { DashboardComponent } from './dashboard.component';

export const ROUTES: Route[] = [
  { path: '', component: DashboardComponent, pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, pathMatch: 'full' },
];
