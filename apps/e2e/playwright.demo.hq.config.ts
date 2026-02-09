import baseConfig from './playwright.config';

export default {
  ...baseConfig,
  fullyParallel: false,
  workers: 1,
  use: {
    ...baseConfig.use,
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      ...(baseConfig.use?.launchOptions ?? {}),
      slowMo: 120,
    },
  },
};
