import { createWideEventLogger, getDefaultEnvironmentContext } from '@retirement/logger';

export const logger = createWideEventLogger({
  base: {
    service_name: 'retirement-webapp',
    service_version: '0.0.1',
    ...getDefaultEnvironmentContext(),
  },
  pretty: true,
});
