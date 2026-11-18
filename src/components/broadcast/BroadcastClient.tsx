"use client";

import { Broadcaster } from "@/components/broadcast/Broadcaster";
import type { Stream } from "@/lib/types";

/** 송출 화면 조립: 송출기 (+ 이후 단계에서 녹화/채팅을 붙인다) */
export function BroadcastClient({ stream }: { stream: Pick<Stream, "id" | "title" | "owner_id"> }) {
  return <Broadcaster stream={stream} />;
}
