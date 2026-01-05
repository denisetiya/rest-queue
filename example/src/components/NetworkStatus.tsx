interface NetworkStatusProps {
    isOnline: boolean;
}

export function NetworkStatus({ isOnline }: NetworkStatusProps) {
    return (
        <div className={`status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'System Online' : 'Network Offline - Queueing Mode'}
        </div>
    );
}
