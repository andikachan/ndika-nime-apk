import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const HEARTBEAT_INTERVAL_MS = 45 * 1000;

const PresenceHeartbeat = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        fetch('/api/v1/social/heartbeat', {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
      }
    };

    sendHeartbeat();
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated]);

  return null;
};

export default PresenceHeartbeat;
