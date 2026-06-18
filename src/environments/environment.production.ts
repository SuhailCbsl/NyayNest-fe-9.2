import { AuthConfig } from 'src/config/auth-config.interfaces';
import { BuildConfig } from '../config/build-config.interface';

export const environment: Partial<BuildConfig> & {
  universal?: any;
  metadataBasePaths?: any;
} = {
  production: true,
  // Angular Universal settings
  universal: {
    preboot: true,
    async: true,
    time: false,
    inlineCriticalCss: false,
    transferState: true,
    replaceRestUrl: true,
    paths: [
      '/home',
      '/items/',
      '/entities/',
      '/collections/',
      '/communities/',
      '/bitstream/',
      '/bitstreams/',
      '/handle/',
      '/reload/',
    ],
    enableSearchComponent: false,
    enableBrowseComponent: false,
  },
  metadataBasePaths: {
    //change these paths as per production server setup
    windows: 'D:/nyaynest/',
    linux: '/nyaynest/',
    dms_directory_windows: 'D:/nyaynest/dspace-9.2/bin/',
    dms_directory_linux: '/nyaynest/dspace-9.2/bin/',
    email_templates: 'admin@dspace.com',
    temp_directory_windows: 'D:/nyaynest/workflowuploadcsv/temp/',
    temp_directory_linux: '/nyaynest/workflowuploadcsv/temp/',
  },
  // Authentication settings
  auth: {
    // Authentication UI settings
    ui: {
      // the amount of time before the idle warning is shown
      timeUntilIdle: 60 * 60 * 1000, // 1 Hour
      // the amount of time the user has to react after the idle warning is shown before they are logged out.
      idleGracePeriod: 5 * 60 * 1000, // 5 minutes
    },
    // Authentication REST settings
    rest: {
      // If the rest token expires in less than this amount of time, it will be refreshed automatically.
      // This is independent from the idle warning.
      timeLeftBeforeTokenRefresh: 10 * 60 * 1000, // 10 minutes refresh 10 min before expiry
    },
  } as AuthConfig,
  // Angular SSR (Server Side Rendering) settings
  ssr: {
    enabled: true,
    enablePerformanceProfiler: false,
    inlineCriticalCss: false,
    transferState: true,
    replaceRestUrl: true,
    excludePathPatterns: [
      {
        pattern: '^/communities/[a-f0-9-]{36}/browse(/.*)?$',
        flag: 'i',
      },
      {
        pattern: '^/collections/[a-f0-9-]{36}/browse(/.*)?$',
        flag: 'i',
      },
      { pattern: '^/browse/' },
      { pattern: '^/search' },
      { pattern: '^/community-list$' },
      { pattern: '^/statistics/?' },
      { pattern: '^/admin/' },
      { pattern: '^/processes/?' },
      { pattern: '^/notifications/' },
      { pattern: '^/access-control/' },
      { pattern: '^/health$' },
    ],
    enableSearchComponent: false,
    enableBrowseComponent: false,
  },
};
