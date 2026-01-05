export type HttpMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type QueueItemStatus = 'PENDING' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'FAILED';

export interface QueueItem {
  id: string;
  tempId?: string;
  url: string;
  method: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  status: QueueItemStatus;
  retryCount: number;
  userId?: string;
  error?: string;
}

export interface QueueConfig {
  remoteUrl?: string;
  retryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
  };
  userId?: string;
  onBeforeSend?: (request: QueueItem) => Promise<QueueItem | void>;
  onQueueChange?: (queue: QueueItem[]) => void;
}

export type QueueEventType = 'queue_update' | 'process_success' | 'process_fail';
export type QueueEventCallback = (data?: unknown) => void;
