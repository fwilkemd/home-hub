/**
 * useNow — coarse real-time ticker for expiring UI (toasts, speech bubbles,
 * exam cards). Re-renders the subscriber every `intervalMs`.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
