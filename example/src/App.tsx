import { useState } from 'react';
import { useQueue } from './hooks/useQueue';
import { NetworkStatus } from './components/NetworkStatus';
import { QueueList } from './components/QueueList';
import { Logs } from './components/Logs';
import { Controls } from './components/Controls';
import './App.css';

function App() {
  const { items, isOnline } = useQueue();
  const [logs, setLogs] = useState<string[]>([]);

  const handleLog = (msg: string) => {
      setLogs(prev => [...prev, msg]);
  };

  return (
    <div className="container">
      <h1>Sync-Later Demo</h1>
      
      <NetworkStatus isOnline={isOnline} />
      <Controls onLog={handleLog} />

      <div className="split-view">
        <QueueList items={items} />
        <Logs logs={logs} />
      </div>
    </div>
  )
}

export default App
