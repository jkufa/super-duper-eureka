import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = ({ locals }) => {
  return {
    requestId: locals.requestId,
    debugEnabled: env.DEBUG === 'true',
  };
};
