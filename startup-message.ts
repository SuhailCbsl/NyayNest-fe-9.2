import PACKAGE_JSON from './package.json';
import { BuildConfig } from './src/config/build-config.interface';

/**
 * Log a message at the start of the application containing the version number and the environment.
 *
 * @param environment   the environment configuration
 */
export const logStartupMessage = (environment: Partial<BuildConfig>) => {
  const env: string = environment.production ? 'Production' : 'Development';
  const color: string = environment.production ? 'red' : 'green';
};
