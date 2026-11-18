import type { Stream } from "@/lib/types";

/** 송출 중 하트비트 주기와, 이 시간 이상 하트비트가 없으면 비정상 종료로 본다. */
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const HEARTBEAT_STALE_MS = 75_000;

/**
 * DB 상의 status 와 마지막 하트비트를 함께 보고 실제로 방송 중인지 판단한다.
 * 탭 닫기 등으로 종료 요청이 전달되지 못해도 하트비트가 끊기면 offline 으로 취급한다.
 */
export function isEffectivelyLive(
  stream: Pick<Stream, "status" | "last_seen_at">,
  now: number = Date.now(),
): boolean {
  if (stream.status !== "live") return false;
  if (!stream.last_seen_at) return false;
  return now - new Date(stream.last_seen_at).getTime() < HEARTBEAT_STALE_MS;
}

export function roomNameFor(streamId: string): string {
  return `stream-${streamId}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
