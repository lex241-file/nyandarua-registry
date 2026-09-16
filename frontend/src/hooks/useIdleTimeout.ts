import { useEffect, useRef, useState } from 'react';

const WARNING_BEFORE_MS = 60 * 1000; // warn 1 minute before logout

/**
 * Logs the user out after `timeoutMs` of inactivity, showing a warning
 * banner during the final minute. Any click/keydown/mousemove/touch/
 * scroll resets the countdown.
 */
export function useIdleTimeout(active: boolean, timeoutMs: number, onTimeout: () => void) {
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
      }, Math.max(timeoutMs - WARNING_BEFORE_MS, 0));
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
  }, [active, timeoutMs]);

  return { showWarning };
}
