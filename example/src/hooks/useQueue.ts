import { useState, useEffect } from 'react';
import { type QueueItem } from 'sync-later';
import { queue } from '../lib/queue';

export function useQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    queue.getQueue().then(setItems);

    const updateCallback = (newQueue: QueueItem[]) => {
        setItems([...newQueue]);
    };

    queue.addListener('queue_update', updateCallback);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
       queue.removeListener('queue_update', updateCallback);
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
    }
  }, []);

  return { items, isOnline };
}
