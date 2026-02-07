import type { Handle } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

export const handle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  event.locals.requestId = requestId;
  event.locals.logContext = {
    request_id: requestId,
  };

  let statusCode = 500;
  let outcome: 'success' | 'error' = 'success';
  let errorContext: { message: string; type?: string } | undefined;

  try {
    const response = await resolve(event);
    statusCode = response.status;
    outcome = statusCode >= 500 ? 'error' : 'success';
    return response;
  }
  catch (error) {
    outcome = 'error';
    const err = error as Error;
    errorContext = { message: err.message, type: err.name };
    throw error;
  }
  finally {
    // logger.info({
    //   event_type: 'http_request',
    //   request_id: requestId,
    //   method: event.request.method,
    //   path: event.url.pathname,
    //   status_code: statusCode,
    //   outcome,
    //   duration_ms: Date.now() - start,
    //   ...event.locals.logContext,
    //   ...(errorContext ? { error: errorContext } : {}),
    // });
  }
};
