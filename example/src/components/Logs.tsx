interface LogsProps {
    logs: string[];
}

export function Logs({ logs }: LogsProps) {
    return (
        <div className="logs">
           <h2>Logs</h2>
           {logs.map((l, i) => <div key={i} className="log-entry">&gt; {l}</div>)}
        </div>
    );
}
