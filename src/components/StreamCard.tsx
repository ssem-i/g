import Link from "next/link";
import { isEffectivelyLive } from "@/lib/live";
import type { StreamWithOwner } from "@/lib/types";

export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white ${className}`}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
      LIVE
    </span>
  );
}

export function StreamCard({ stream }: { stream: StreamWithOwner }) {
  const live = isEffectivelyLive(stream);
  return (
    <Link href={`/streams/${stream.id}`} className="group block">
      <div
        className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border ${
          live ? "border-live/60 bg-gradient-to-br from-live/20 to-surface-2" : "border-border bg-surface-2"
        }`}
      >
        <span className="px-4 text-center text-sm font-semibold text-muted group-hover:text-foreground">
          {live ? "지금 방송 중 — 눌러서 시청" : "방송 준비 중"}
        </span>
        <div className="absolute left-2 top-2 flex gap-1">
          {live ? (
            <LiveBadge />
          ) : (
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-muted">OFFLINE</span>
          )}
        </div>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-foreground">
          {stream.category}
        </span>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-semibold group-hover:text-accent">{stream.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{stream.owner?.nickname ?? "알 수 없음"}</p>
      </div>
    </Link>
  );
}

export function StreamGrid({ streams }: { streams: StreamWithOwner[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {streams.map((s) => (
        <StreamCard key={s.id} stream={s} />
      ))}
    </div>
  );
}
