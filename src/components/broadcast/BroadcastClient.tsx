"use client";

import { Broadcaster } from "@/components/broadcast/Broadcaster";
import { ChatPanel, type ChatViewer } from "@/components/chat/ChatPanel";
import type { Stream } from "@/lib/types";

/** 송출 화면 조립: 송출기 + 채팅(스트리머가 보면서 관리) */
export function BroadcastClient({
  stream,
  viewer,
}: {
  stream: Pick<Stream, "id" | "title" | "owner_id">;
  viewer: ChatViewer;
}) {
  return (
    <div className="space-y-4">
      <Broadcaster stream={stream} />
      <ChatPanel streamId={stream.id} ownerId={stream.owner_id} viewer={viewer} className="h-[380px]" />
    </div>
  );
}
