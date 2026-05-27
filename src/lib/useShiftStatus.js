import { useEffect, useState } from "react";
import { apiGet } from "./api.js";

export default function useShiftStatus({ pollMs = 20000 } = {}) {
  const [status, setStatus] = useState(undefined); // undefined = loading, null = no shift, object = open
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await apiGet("/shifts/current", { auth: false });
        if (alive) {
          setStatus(s);
          setLoading(false);
        }
      } catch {
        if (alive) setLoading(false);
      }
    };
    tick();
    const t = setInterval(tick, pollMs);
    const onEvent = () => tick();
    window.addEventListener("foodpos:shift-changed", onEvent);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("foodpos:shift-changed", onEvent);
    };
  }, [pollMs]);

  return { shift: status, loading, isOpen: status?.status === "open" };
}
