import { useEffect, useRef, useState } from 'react';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_BEFORE_MS = 60 * 1000; // warn 1 minute before logout

/**
 * Logs the user out after 5 minutes of inactivity, showing a warning
 * banner during the final minute. Mirrors the original app's idle timer.
 * Any click/keydown/mousemove/touch/scroll resets the countdown.
 */
export function useIdleTimeout(active: boolean, onTimeout: () => void) {
  const [showWarning, setShowWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    function clearTimers() {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    }

    function reset() {
      clearTimers();
      setShowWarning(false);
      timerRef.current = setTimeout(() => {
        setShowWarning(true);
        warningTimerRef.current = setTimeout(() => {
          onTimeout();
        }, WARNING_BEFORE_MS);
      }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
    }

    const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    const handler = () => reset();
    events.forEach((ev) => document.addEventListener(ev, handler, { passive: true }));
    reset();

    return () => {
      clearTimers();
      events.forEach((ev) => document.removeEventListener(ev, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { showWarning };
}
