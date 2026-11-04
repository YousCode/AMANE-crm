/* Mode développement / tests Playwright : service worker msw + bus « WebSocket » simulé sur window.__amaneMock. */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { sim } from './fakeApi';

export async function startMocks() {
  window.__amaneMock = sim as unknown as Window['__amaneMock'];
  const worker = setupWorker(...handlers);
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` } });
}
