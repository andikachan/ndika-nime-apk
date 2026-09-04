import { useState, useEffect, useRef } from 'react';

export const useWatchTime = (user, animeId, onLevelUp) => {
  const [watchTime, setWatchTime] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Start watching
  const startWatching = () => {
    if (!user) return;
    setIsWatching(true);
    startTimeRef.current = Date.now();
    
    // Update every 30 seconds
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (elapsed >= 30) {
        updateWatchTime(elapsed);
        startTimeRef.current = Date.now();
      }
    }, 10000);
  };

  // Stop watching
  const stopWatching = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Send remaining watch time
    if (startTimeRef.current && isWatching) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (elapsed > 0) {
        updateWatchTime(elapsed);
      }
    }
    
    setIsWatching(false);
    startTimeRef.current = null;
  };

  // Update watch time to server
  const updateWatchTime = async (seconds) => {
    if (!user || seconds < 1) return;

    try {
      const res = await fetch('/api/v1/user/watch-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ watchTime: seconds })
      });

      const data = await res.json();
      
      if (res.ok && data.levelUp) {
        if (typeof onLevelUp === 'function') {
          onLevelUp(data.level, data.title);
        } else {
          showLevelUpNotification(data.level, data.title);
        }
      }
    } catch (error) {
      console.error('Update watch time error:', error);
    }
  };

  // Show level up notification
  const showLevelUpNotification = (level, title) => {
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[999] bg-[#F6CF80] text-[#0a0a0c] px-6 py-3 rounded-xl font-bold shadow-2xl animate-[slideDown_0.3s_ease-out]';
    notification.innerHTML = `🎉 Level Up! Level ${level} • ${title}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s';
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (isWatching && startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (elapsed > 0) {
          updateWatchTime(elapsed);
        }
      }
    };
  }, []);

  return { startWatching, stopWatching, isWatching, watchTime };
};
