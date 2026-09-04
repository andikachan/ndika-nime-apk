import { useEffect, useRef } from 'react';

/**
 * Hook polling adaptif yang cerdas.
 * Otomatis pause interval saat tab berada di background (document.hidden),
 * dan langsung memicu fetch sekali saat tab dibuka kembali.
 *
 * @param {Function} callback Fungsi async/sync yang dipanggil tiap interval
 * @param {number|null} delay Interval dalam milidetik (null untuk stop)
 * @param {boolean} immediate Panggil langsung sekali saat mount/tab aktif
 */
export function useAdaptiveInterval(callback, delay, immediate = false) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null || delay === undefined) return;

    let timerId = null;

    const tick = () => {
      if (!document.hidden) {
        savedCallback.current?.();
      }
    };

    const startTimer = () => {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(tick, delay);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
      } else {
        tick();
        startTimer();
      }
    };

    if (immediate && !document.hidden) {
      tick();
    }

    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerId) clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delay, immediate]);
}

export default useAdaptiveInterval;
