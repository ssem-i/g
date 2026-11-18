"use client";

import { ChatPanel, type ChatViewer } from "@/components/chat/ChatPanel";
import { Viewer } from "@/components/viewer/Viewer";
import type { Stream } from "@/lib/types";

interface Props {
  stream: Pick<Stream, "id" | "owner_id" | "status" | "last_seen_at">;
  viewer: ChatViewer | null;
  children?: React.ReactNode;
}

/** 방송 상세: 플레이어 + 채팅 (+ 후원) 을 묶는 클라이언트 영역 */
export function WatchRoom({ stream, viewer, children }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Viewer stream={{ id: stream.id, status: stream.status, last_seen_at: stream.last_seen_at }} />
        {children}
      </div>
      <ChatPanel
        streamId={stream.id}
        ownerId={stream.owner_id}
        viewer={viewer}
        className="h-[420px] lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]"
      />
    </div>
  );
}
