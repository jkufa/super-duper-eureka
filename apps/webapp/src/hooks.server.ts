import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const requestId = crypto.randomUUID();

  event.locals.requestId = requestId;
  event.locals.logContext = { request_id: requestId };

  return resolve(event);
};
