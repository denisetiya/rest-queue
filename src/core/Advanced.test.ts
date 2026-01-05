import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { RequestQueue } from './Queue';

// Mock IndexedDB
const mockPersistence = {
  hydrate: vi.fn().mockResolvedValue([]),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
  clear: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../storage/IndexedDB', () => {
  return {
    Persistence: class {
      hydrate = mockPersistence.hydrate;
      save = mockPersistence.save;
      delete = mockPersistence.delete;
      getAll = mockPersistence.getAll;
      clear = mockPersistence.clear;
    }
  };
});

describe('Advanced Features (Phase 5)', () => {
    let queue: RequestQueue;

    beforeEach(async () => {
        vi.clearAllMocks();
        global.fetch = vi.fn() as unknown as typeof fetch;
        queue = new RequestQueue({ retryPolicy: { maxRetries: 0, initialDelayMs: 0 } });
        // Wait for hydrate
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should emit queue_update event when item is added', async () => {
        const spy = vi.fn();
        queue.addListener('queue_update', spy);

        await queue.add({ url: '/test', method: 'POST' });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ url: '/test' })]));
    });

    it('should allow removing (cancelling) a pending request', async () => {
       Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

       const id = await queue.add({ url: '/cancel-me', method: 'POST' });
       expect((await queue.getQueue()).length).toBe(1);

       await queue.remove(id);
       expect((await queue.getQueue()).length).toBe(0);
       expect(mockPersistence.delete).toHaveBeenCalledWith(id);
    });

    it('should emit process_success event when request completes', async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

        (global.fetch as unknown as Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
            text: async () => JSON.stringify({ success: true }),
        });

        const spy = vi.fn();
        queue.addListener('process_success', spy);

        await queue.add({ url: '/success', method: 'POST' });

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ 
            response: { success: true }
        }));
    });

    it('should handle FormData in add and performRequest', async () => {
        class FormDataMock {
            append = vi.fn();
        }
        global.FormData = FormDataMock as unknown as typeof FormData;
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        
        (global.fetch as unknown as Mock).mockResolvedValue({
            ok: true,
            json: async () => ({}),
            text: async () => '{}',
        });

        const formData = new FormData();
        await queue.add({ url: '/upload', method: 'POST', body: formData });
        
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(global.fetch).toHaveBeenCalledWith('/upload', expect.objectContaining({
            body: formData
        }));
        
        const headers = (global.fetch as unknown as Mock).mock.calls[0][1].headers;
        expect(headers['Content-Type']).toBeUndefined();
    });
});
