import { QueueItem, QueueConfig, QueueEventType, QueueEventCallback } from '../types';
import { Persistence } from '../storage/IndexedDB';

export class RequestQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private config: QueueConfig;
  private storage: Persistence;
  private readyPromise: Promise<void>;
  private listeners: Map<QueueEventType, Set<QueueEventCallback>> = new Map();

  constructor(config: QueueConfig = {}) {
    this.config = config;
    this.storage = new Persistence();
    this.setupNetworkListener();
    this.readyPromise = this.hydrate();
  }

  public addListener(type: QueueEventType, callback: QueueEventCallback): void {
      if (!this.listeners.has(type)) {
          this.listeners.set(type, new Set());
      }
      this.listeners.get(type)?.add(callback);
  }

  public removeListener(type: QueueEventType, callback: QueueEventCallback): void {
      this.listeners.get(type)?.delete(callback);
  }

  private emit(type: QueueEventType, data?: unknown): void {
      this.listeners.get(type)?.forEach(cb => cb(data));
      
      if (type === 'queue_update' && this.config.onQueueChange) {
          this.config.onQueueChange(this.queue);
      }
  }

  private setupNetworkListener() {
      if (typeof window !== 'undefined' && window.addEventListener) {
          window.addEventListener('online', () => {
              console.log('Network online, processing queue...');
              this.process();
          });
      }
  }

  private async hydrate(): Promise<void> {
    try {
      const storedItems = await this.storage.getAll<QueueItem>();
      if (storedItems && storedItems.length > 0) {
        this.queue = storedItems.sort((a, b) => a.createdAt - b.createdAt);
      }
    } catch (error) {
      console.warn('Failed to hydrate queue from storage', error);
    }
  }

  /**
   * Add a request to the queue
   */
  public async add(request: Omit<QueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>): Promise<string> {
    await this.readyPromise;

    const isSimpleBody = !request.body || (typeof request.body === 'object' && !(request.body instanceof Blob) && !(request.body instanceof FormData));
    
    if (isSimpleBody) {
        const requestBodyStr = request.body ? JSON.stringify(request.body) : '';
        const existing = this.queue.find(item => 
            item.status === 'PENDING' &&
            item.url === request.url && 
            item.method === request.method &&
            (item.body ? JSON.stringify(item.body) : '') === requestBodyStr
        );

        if (existing) {
            console.warn('Duplicate request detected, ignoring.', request);
            return existing.id;
        }
    }

    const id = crypto.randomUUID();
    const item: QueueItem = {
      ...request,
      id,
      createdAt: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    this.queue.push(item);
    await this.storage.save(item);
    
    this.emit('queue_update', this.queue);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return id;
    }
    this.process();

    return id;
  }

   /**
   * Remove a request (Cancel)
   */
  public async remove(id: string): Promise<void> {
      await this.readyPromise;
      const index = this.queue.findIndex(i => i.id === id);
      if (index === -1) return;

      const item = this.queue[index];
      if (item.status === 'PROCESSING') {
          console.warn('Cannot cancel a request that is currently processing:', id);
          return; 
      }

      this.queue.splice(index, 1);
      await this.storage.delete(id);
      this.emit('queue_update', this.queue);
  }

  /**
   * Process the queue serially
   */
  private async process(): Promise<void> {
    if (this.isProcessing) return;
    await this.readyPromise;
    if (this.queue.length === 0) return;
    
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
    }

    this.isProcessing = true;

    try {
      const item = this.queue[0];

      
      if (this.config.userId && item.userId && item.userId !== this.config.userId) {
         this.isProcessing = false;
         return;
      }

      if (item.status === 'RETRYING') {
          const policy = this.config.retryPolicy || { maxRetries: 3, initialDelayMs: 1000 };
          const delay = policy.initialDelayMs * Math.pow(2, item.retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
      }

      item.status = 'PROCESSING';
      await this.storage.save(item);
      this.emit('queue_update', this.queue);

      let requestItem = item;
      if (this.config.onBeforeSend) {
          const modified = await this.config.onBeforeSend(item);
          if (modified) {
              requestItem = modified as QueueItem;
          }
      }

      try {
        const responseBody = await this.performRequest(requestItem);
        item.status = 'COMPLETED';
        this.emit('process_success', { id: item.id, response: responseBody });
         
         if (item.tempId && responseBody && typeof responseBody === 'object' && 'id' in responseBody) {
             const realId = String((responseBody as { id: unknown }).id);
             await this.resolveDependencies(item.tempId, realId);
         }

         this.queue.shift();
         await this.storage.delete(item.id);
         this.emit('queue_update', this.queue);
      } catch (error) {
        console.error('Request failed', error);
        
        const maxRetries = this.config.retryPolicy?.maxRetries ?? 3;
        if (item.retryCount < maxRetries) {
            item.status = 'RETRYING';
            item.retryCount++;
            item.error = String(error);
            await this.storage.save(item);
            this.emit('queue_update', this.queue);
        } else {
            item.status = 'FAILED';
            item.error = String(error);
            
            this.queue.shift();
            await this.storage.delete(item.id);
            this.emit('process_fail', { id: item.id, error });
            this.emit('queue_update', this.queue);
        }
      }
      
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this.process();
      }
    }
  }

  private async resolveDependencies(tempId: string, realId: string): Promise<void> {
      for (const item of this.queue) {
          if (item.status !== 'PENDING') continue;

          let changed = false;

          if (item.url.includes(tempId)) {
              item.url = item.url.replace(tempId, realId);
              changed = true;
          }

          if (item.body) {
              const bodyStr = JSON.stringify(item.body);
              if (bodyStr.includes(tempId)) {
                  const newBodyStr = bodyStr.replaceAll(tempId, realId);
                  item.body = JSON.parse(newBodyStr);
                  changed = true;
              }
          }

          if (changed) {
              await this.storage.save(item);
          }
      }
  }

  private async performRequest(item: QueueItem): Promise<unknown> {
    const headers: Record<string, string> = { ...item.headers };
    let body: BodyInit | undefined;

    if (item.body instanceof FormData || item.body instanceof Blob || item.body instanceof File) {
        body = item.body as BodyInit;
    } else if (item.body) {
        body = JSON.stringify(item.body);
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
    }

    const response = await fetch(item.url, {
      method: item.method,
      body,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        return {};
    }
  }
  
  public async getQueue(): Promise<QueueItem[]> {
      await this.readyPromise;
      return [...this.queue];
  }
}
