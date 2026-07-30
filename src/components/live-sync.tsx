"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type LiveState = {
  connected: boolean;
  unread: number;
  openQueue: number;
  lastEventAt: string | null;
  pulse: number;
};

const LiveCtx = createContext<LiveState>({
  connected: false,
  unread: 0,
  openQueue: 0,
  lastEventAt: null,
  pulse: 0,
});

export function useLive() {
  return useContext(LiveCtx);
}

/** Polls /api/realtime and refreshes the current route when the org desk changes. */
export function LiveSyncProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sinceRef = useRef(new Date().toISOString());
  const [state, setState] = useState<LiveState>({
    connected: false,
    unread: 0,
    openQueue: 0,
    lastEventAt: null,
    pulse: 0,
  });

  const tick = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    try {
      const res = await fetch(
        `/api/realtime?since=${encodeURIComponent(sinceRef.current)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setState((s) => ({ ...s, connected: false }));
        return;
      }
      const data = await res.json();
      if (data.cursor) sinceRef.current = data.cursor;
      setState((s) => ({
        connected: true,
        unread: data.unread ?? 0,
        openQueue: data.openQueue ?? 0,
        lastEventAt: data.serverTime || s.lastEventAt,
        pulse: data.changed ? s.pulse + 1 : s.pulse,
      }));
      if (data.changed) {
        router.refresh();
      }
    } catch {
      setState((s) => ({ ...s, connected: false }));
    }
  }, [router]);

  useEffect(() => {
    void tick();
    const id = setInterval(() => void tick(), 3500);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tick]);

  return <LiveCtx.Provider value={state}>{children}</LiveCtx.Provider>;
}

export function LiveBadge() {
  const live = useLive();
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
      title={
        live.connected
          ? `Live · ${live.openQueue} open in queue`
          : "Reconnecting…"
      }
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          live.connected ? "animate-pulse bg-emerald-500" : "bg-slate-300"
        }`}
      />
      {live.connected ? "Live" : "Offline"}
      {live.openQueue > 0 ? (
        <span className="text-slate-400">· {live.openQueue}</span>
      ) : null}
    </div>
  );
}
