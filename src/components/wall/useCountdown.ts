"use client";

import { useEffect, useMemo, useState } from "react";

export function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  return useMemo(() => {
    if (!target) return null;
    const milliseconds = Math.max(0, new Date(target).getTime() - now);
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      done: milliseconds === 0,
      hours,
      minutes,
      seconds,
      label: [hours, minutes, seconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":"),
    };
  }, [now, target]);
}
