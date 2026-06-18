import { AsyncPipe, NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { select, Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest, map, Observable } from 'rxjs';

import { AppState } from '../../../app.reducer';
import {
  getProfileModuleRoute,
  getSubscriptionsModuleRoute,
} from '../../../app-routing-paths';
import { AuthService } from '../../../core/auth/auth.service';
import { isAuthenticationLoading } from '../../../core/auth/selectors';
import { DSONameService } from '../../../core/breadcrumbs/dso-name.service';
import { EPerson } from '../../../core/eperson/models/eperson.model';
import { MYDSPACE_ROUTE } from '../../../my-dspace-page/my-dspace-page.component';
import { ThemedLoadingComponent } from '../../loading/themed-loading.component';
import { LogOutComponent } from '../../log-out/log-out.component';
import { RoleService } from '../../../core/roles/role.service';
import { MyDSpaceConfigurationService } from 'src/app/my-dspace-page/my-dspace-configuration.service';

/**
 * This component represents the user nav menu.
 */
@Component({
  selector: 'ds-base-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
  imports: [
    AsyncPipe,
    LogOutComponent,
    NgClass,
    RouterLink,
    RouterLinkActive,
    ThemedLoadingComponent,
    TranslateModule,
  ],
})
export class UserMenuComponent implements OnInit {
  /**
   * The input flag to show user details in navbar expandable menu
   */
  @Input() inExpandableNavbar = false;

  /**
   * Emits an event when the route changes
   */
  @Output() changedRoute: EventEmitter<any> = new EventEmitter<any>();

  /**
   * True if the authentication is loading.
   * @type {Observable<boolean>}
   */
  public loading$: Observable<boolean>;

  /**
   * The authenticated user.
   * @type {Observable<EPerson>}
   */
  public user$: Observable<EPerson>;

  /**
   * The mydspace page route.
   * @type {string}
   */
  public mydspaceRoute = MYDSPACE_ROUTE;
  public workflowConfiguration$: Observable<string>;

  /**
   * The profile page route
   */
  public profileRoute = getProfileModuleRoute();

  /**
   * The profile page route
   */
  public subscriptionsRoute = getSubscriptionsModuleRoute();

  constructor(
    protected store: Store<AppState>,
    protected authService: AuthService,
    public dsoNameService: DSONameService,
  ) {}

  /**
   * Initialize all instance variables
   */
  ngOnInit(): void {
    // set loading
    this.loading$ = this.store.pipe(select(isAuthenticationLoading));

    // set user
    this.user$ = this.authService.getAuthenticatedUserFromStore();

    // set workflow user
    // this.workflowConfiguration$ = combineLatest([
    //   this.roleService.isSubmitter(),
    //   this.roleService.isController(),
    //   this.roleService.isAdmin(),
    // ]).pipe(
    //   map(([isSubmitter, isController, isAdmin]) => {
    //     // Pure submitter
    //     if (isSubmitter && !isController && !isAdmin) {
    //       return 'workspace';
    //     }

    //     // Workflow users
    //     return 'workflow';
    //   }),
    // );
  }

  /**
   * Emits an event when the menu item is clicked
   */
  onMenuItemClick() {
    this.changedRoute.emit();
  }
}
