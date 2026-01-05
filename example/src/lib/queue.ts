import { RequestQueue } from 'sync-later';

export const queue = new RequestQueue({
  remoteUrl: 'https://jsonplaceholder.typicode.com',
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 1000
  }
});
