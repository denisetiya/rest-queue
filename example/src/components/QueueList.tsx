import { type QueueItem } from 'sync-later';
import { queue } from '../lib/queue';

interface QueueListProps {
    items: QueueItem[];
}

export function QueueList({ items }: QueueListProps) {
    const handleCancel = (id: string) => {
        queue.remove(id);
    };

    return (
        <div className="queue-list">
          <h2>Queue ({items.length})</h2>
          {items.length === 0 ? <p>Queue is empty</p> : (
            <ul>
              {items.map(item => (
                <li key={item.id} className={`item`}>
                  <div className="item-header">
                      <div>
                        <span className="method">{item.method}</span>
                        <span className="url">{item.url}</span>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <span className={`badge ${item.status}`}>{item.status}</span>
                        {(item.status === 'PENDING' || item.status === 'RETRYING') && (
                            <button 
                                onClick={() => handleCancel(item.id)}
                                style={{
                                    padding: '2px 6px', 
                                    fontSize: '0.7rem', 
                                    background: 'transparent', 
                                    border: '1px solid #666', 
                                    color: '#666',
                                    cursor: 'pointer'
                                }}
                                title="Cancel Request"
                            >
                                ✕
                            </button>
                        )}
                      </div>
                  </div>
                  
                  <div className="meta-info">
                      <span>id: {item.id.slice(0,8)}...</span>
                      {item.retryCount > 0 && <span style={{color: 'var(--warning-color)'}}>Retries: {item.retryCount}</span>}
                      {item.tempId && <span style={{color: 'var(--accent-color)'}}>TempID: {item.tempId}</span>}
                  </div>

                  {item.body ? <div className="payload-preview">{JSON.stringify(item.body)}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
    );
}
