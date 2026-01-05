import { queue } from '../lib/queue';

interface ControlsProps {
    onLog: (msg: string) => void;
}

export function Controls({ onLog }: ControlsProps) {
    
  const addRequest = async () => {
    const id = await queue.add({
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      body: { title: 'New Post', body: 'Content...', userId: 1 }
    });
    onLog(`Added Request: ${id}`);
  };

  const addDependencyChain = async () => {
     const tempId = `temp-${Date.now()}`;
     
     await queue.add({
       tempId,
       url: 'https://jsonplaceholder.typicode.com/posts',
       method: 'POST',
       body: { title: 'Parent Post' }
     });
     onLog(`Added Parent with tempId: ${tempId}`);

     await queue.add({
       url: 'https://jsonplaceholder.typicode.com/comments',
       method: 'POST',
       body: { postId: tempId, name: 'Child Comment', email: 'test@test.com', body: 'This depends on parent' }
     });
     onLog(`Added Child depending on: ${tempId}`);
  };

  const addFailingRequest = async () => {
      await queue.add({
          url: 'https://non-existent-url.com/fail',
          method: 'POST'
      });
      onLog(`Added Failing Request`);
  }

  return (
      <div className="controls">
        <button onClick={addRequest}>Add Normal Request</button>
        <button onClick={addDependencyChain}>Add Dependency Chain (Parent &rarr; Child)</button>
        <button onClick={addFailingRequest}>Add Failing Request (Test Retry)</button>
        <button onClick={() => window.location.reload()}>Reload Page (Test Persistence)</button>
      </div>
  );
}
