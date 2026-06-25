"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` when the browser believes it has network access, `false`
 * when `navigator.onLine` is false or the browser fires an `offline` event.
 *
 * Note: `navigator.onLine` is a hint, not a guarantee of actual connectivity —
 * a machine can be on a LAN without internet access and still report `true`.
 * We use it solely to surface a "you appear to be offline" banner rather than
 * for any critical path logic.
 */
export function useOnlineStatus(): boolean {
  // Always initialise to `true` so the server-rendered HTML and the first
  // client render agree. The effect below immediately corrects the value to
  // the real `navigator.onLine` state after hydration completes.
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Sync to the real value once we're in the browser.
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
