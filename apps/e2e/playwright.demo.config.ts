import baseConfig from './playwright.config';

export default {
  ...baseConfig,
  fullyParallel: false,
  workers: 1,
  use: {
    ...baseConfig.use,
    video: 'on',
    launchOptions: {
      ...(baseConfig.use?.launchOptions ?? {}),
      slowMo: 180,
    },
  },
};
