import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestQueue } from './Queue';

global.fetch = vi.fn();

function createMockResponse(ok: boolean, body: unknown = {}) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

// ... omitted imports ...


vi.mock('../storage/IndexedDB', () => {
    return {
        Persistence: class {
            getAll = vi.fn().mockResolvedValue([]);
            save = vi.fn().mockResolvedValue(undefined);
            delete = vi.fn().mockResolvedValue(undefined);
            clear = vi.fn().mockResolvedValue(undefined);
        }
    };
});

describe('RequestQueue Core', () => {
    let queue: RequestQueue;

    beforeEach(() => {
        vi.clearAllMocks();
        queue = new RequestQueue();
    });

    it('should add a request to the queue and start processing immediately', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(true));

        const id = await queue.add({
            url: 'https://api.example.com/users',
            method: 'POST',
            body: { name: 'Test User' }
        });

        expect(id).toBeDefined();
        
        const items = await queue.getQueue();
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].id).toBe(id);
        
        if (items.length > 0) {
             expect(['PENDING', 'PROCESSING', 'COMPLETED']).toContain(items[0].status);
        }
    });

    it('should process a request successfully', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockResponse(true));

        await queue.add({
            url: 'https://api.example.com/users',
            method: 'POST',
            body: { name: 'Test User' }
        });

        
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = await queue.getQueue();
        expect(items).toHaveLength(0);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should remove failed request', async () => {
         queue = new RequestQueue({ retryPolicy: { maxRetries: 0, initialDelayMs: 0 } });
         (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockResponse(false));

         await queue.add({
            url: 'https://api.example.com/fail',
            method: 'POST'
         });

         await new Promise(resolve => setTimeout(resolve, 50));

         const items = await queue.getQueue();
         expect(items).toHaveLength(0);
         expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    it('should resolve dependencies (replace tempId with realId)', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(createMockResponse(true, { id: 100 }))
            .mockResolvedValueOnce(createMockResponse(true, { id: 200 }));

        const tempId = 'temp-123';
        const realId = '100';

        // Add Parent Request
        await queue.add({
            tempId,
            url: 'https://api.example.com/parents',
            method: 'POST',
            body: { name: 'Parent' }
        });

        await queue.add({
            url: 'https://api.example.com/children',
            method: 'POST',
            body: { parentId: tempId, name: 'Child' }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const items = await queue.getQueue();
        expect(items).toHaveLength(0);
        expect(global.fetch).toHaveBeenCalledTimes(2);

        const secondCallArgs = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
        const bodyOfSecondRequest = JSON.parse(secondCallArgs[1].body);
        expect(bodyOfSecondRequest.parentId).toBe(realId);
    });

    it('should retry failed requests with backoff', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockResolvedValueOnce(createMockResponse(true, { id: 300 }));
        
        queue = new RequestQueue({
            retryPolicy: {
                maxRetries: 3,
                initialDelayMs: 10 
            }
        });

        await queue.add({
            url: 'https://api.example.com/retry',
            method: 'POST'
        });

        await new Promise(resolve => setTimeout(resolve, 150));

        const items = await queue.getQueue();
        expect(items).toHaveLength(0);
        expect(global.fetch).toHaveBeenCalledTimes(3); 
    });
});

