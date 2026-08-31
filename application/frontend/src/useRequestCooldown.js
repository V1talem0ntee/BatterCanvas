import { useCallback, useEffect, useRef, useState } from "react";

function useRequestCooldown(durationMs = 6000) {
  const cooldownUntilRef = useRef(0);
  const timeoutRef = useRef(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  const startCooldown = useCallback(() => {
    const now = Date.now();

    if (now < cooldownUntilRef.current) {
      return false;
    }

    cooldownUntilRef.current = now + durationMs;
    setIsCoolingDown(true);

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      cooldownUntilRef.current = 0;
      timeoutRef.current = null;
      setIsCoolingDown(false);
    }, durationMs);

    return true;
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isCoolingDown, startCooldown };
}

export default useRequestCooldown;
