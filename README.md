# Rest Queue

**Offline Mutation Engine for Standard REST API**

`rest-queue` is a robust, lightweight library designed to ensure your data mutations (POST, PUT, DELETE, PATCH) never fail, even in unstable network conditions. It persists requests, handles retries with exponential backoff, manages complex dependency chains between requests, and now supports file uploads and reactive event updates.

Unlike heavyweight solutions like TanStack Query or Apollo Client which focus on *fetching*, `rest-queue` focuses purely on *reliable mutations*.

## Features 🚀

- **Zero Dependencies**: Pure TypeScript, tiny bundle size.
- **Offline-First**: Requests are persisted to IndexedDB immediately.
- **Resilient**: Automatic retries with exponential backoff strategy.
- **Dependency Chaining**: Create parent-child request chains (e.g., create Post -> create Comment) where the child relies on the parent's ID before the parent even succeeds.
- **Reactive Event System**: Subscribe to queue updates (`queue_update`, `process_success`, `process_fail`).
- **File Support**: First-class support for `FormData`, `Blob`, and `File` uploads.
- **Cancellable**: Cancel pending requests easily.
- **Concurrency Control**: Serial processing guarantees order.

## Installation

```bash
npm install rest-queue
# or
pnpm add rest-queue
# or
yarn add rest-queue
```

## Quick Start

```typescript
import { RequestQueue } from 'rest-queue';

// 1. Initialize the queue
const queue = new RequestQueue({
  retryPolicy: { maxRetries: 3, initialDelayMs: 1000 },
  onQueueChange: (items) => console.log('Queue updated:', items.length)
});

// 2. Add a request (returns a unique ID)
const id = await queue.add({
  url: 'https://api.example.com/posts',
  method: 'POST',
  body: { title: 'Hello World' }
});

// That's it! The library handles the rest:
// - Saves to IndexedDB
// - Checks network status
// - Sends request
// - Retries on failure
// - Removes on success
```

## Core Concepts

### 1. Dependency Chaining 🔗
Execute dependent requests without waiting for the first one to finish. Use a `tempId` that gets replaced automatically when the parent request succeeds.

```typescript
const tempId = 'temp-123';

// 1. Create Parent (Post)
await queue.add({
  tempId, // Assign a temporary ID
  url: '/posts',
  method: 'POST',
  body: { title: 'New Post' }
});

// 2. Create Child (Comment) - Uses tempId
await queue.add({
  url: '/comments',
  method: 'POST',
  body: { 
    postId: tempId, // Will be replaced by real ID (e.g., 101) after parent succeeds
    content: 'Nice post!' 
  }
});
```

### 2. File Uploads 📁
Upload files seamlessly. The library detects `FormData` and skips JSON serialization.

```typescript
const formData = new FormData();
formData.append('file', myFile);

await queue.add({
  url: '/upload',
  method: 'POST',
  body: formData
});
```

### 3. Events & Reactivity ⚡
Update your UI in real-time.

```typescript
queue.addListener('queue_update', (items) => {
  // Update your UI with the latest queue state
  setQueueItems(items);
});

queue.addListener('process_success', ({ id, response }) => {
  console.log(`Request ${id} succeeded!`, response);
});
```

## API Reference

### `RequestQueue`
The main class.

#### Constructor `new RequestQueue(config?)`
- `config.retryPolicy`: `{ maxRetries: number, initialDelayMs: number }`
- `config.userId`: `string` (Optional, for multi-user isolation support)
- `config.onBeforeSend`: `(item) => Promise<item>` (Hook to modify request before sending, e.g., attach tokens)
- `config.onQueueChange`: `(items) => void` (Shortcut for queue_update event)

#### Methods
- `add(request)`: Adds a request. Returns `Promise<string>` (the request ID).
- `remove(id)`: Cancels a pending request.
- `getQueue()`: Returns all current queue items.
- `addListener(event, callback)`: Subscribe to events.
- `removeListener(event, callback)`: Unsubscribe.

### Events
- `queue_update`: Fired whenever the queue adds, removes, or updates an item.
- `process_success`: Fired when a request succeeds.
- `process_fail`: Fired when a request permanently fails (after retries).

## License

ISC © 2026 denisetiya
