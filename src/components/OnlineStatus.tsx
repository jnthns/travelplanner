import { useState, useEffect } from 'react';
import './OnlineStatus.css';

/**
 * Floating banner that appears when the user goes offline.
 * Briefly shows a "Back online" message on reconnect, then hides.
 */
const OnlineStatus: React.FC = () => {
    const [online, setOnline] = useState(navigator.onLine);
    const [visible, setVisible] = useState(false);
    const [reconnected, setReconnected] = useState(false);

    useEffect(() => {
        const goOffline = () => {
            setOnline(false);
            setReconnected(false);
            setVisible(true);
        };

        const goOnline = () => {
            setOnline(true);
            setReconnected(true);
            setVisible(true);
            // Hide the "back online" message after 3 seconds
            const timer = setTimeout(() => setVisible(false), 3000);
            return () => clearTimeout(timer);
        };

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    // Don't render anything if we've never gone offline
    if (!visible && online && !reconnected) return null;

    return (
        <div className={`offline-banner ${visible ? 'visible' : ''} ${online ? 'online' : ''}`}>
            <span className="offline-banner-dot" />
            {online
                ? 'Back online — changes synced'
                : "You're offline — showing saved data where available. Reconnect to refresh. Edits will sync when you're back online."}
        </div>
    );
};

export default OnlineStatus;
