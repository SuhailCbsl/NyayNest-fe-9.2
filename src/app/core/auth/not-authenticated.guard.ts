import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { PAGE_NOT_FOUND_PATH } from 'src/app/app-routing-paths';

import { HardRedirectService } from '../services/hard-redirect.service';
import { AuthService } from './auth.service';

export const notAuthenticatedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const redirectService = inject(HardRedirectService);
  const router = inject(Router);

  return authService.isAuthenticated().pipe(
    map((isLoggedIn) => {
      if (isLoggedIn) {
        router.navigate(['/dashboard']);
        // redirectService.redirect(PAGE_NOT_FOUND_PATH);
        return false;
      }

      return true;
    }),
  );
};
