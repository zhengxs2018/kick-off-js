import { useContext } from '../app/context.js';
import { fromWebResponse } from '../base/node/response.js';

export function respondWith(response: Response) {
  const ctx = useContext();

  if (ctx.writable) {
    ctx.respond = true;
    fromWebResponse(ctx.res, response);
  } else {
    throw new Error('Response is not writable');
  }
}
