/* Vitest : serveur msw Node. */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
export { sim, reset } from './fakeApi';
