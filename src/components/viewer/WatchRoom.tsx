"use client";

import { useCallback, useRef, useState } from "react";
import { ChatPanel, type ChatViewer } from "@/components/chat/ChatPanel";
import { DonationAlert, type DonationEvent } from "@/components/donation/DonationAlert";
import { Viewer } from "@/components/viewer/Viewer";
import type { Stream } from "@/lib/types";

interface Props {
  stream: Pick<Stream, "id" | "owner_id" | "status" | "last_seen_at">;
  viewer: ChatViewer | null;
  children?: React.ReactNode;
}

/** 방송 상세: 플레이어 + 후원 알림 오버레이 + 채팅을 묶는 클라이언트 영역 */
export function WatchRoom({ stream, viewer, children }: Props) {
  const [queue, setQueue] = useState<DonationEvent[]>([]);
  const seq = useRef(0);

  const onDonation = useCallback((d: { nickname: string; amount: number; message: string }) => {
    seq.current += 1;
    const key = seq.current;
    setQueue((q) => [...q, { key, ...d }].slice(-20));
  }, []);
  const onShown = useCallback((key: number) => setQueue((q) => q.filter((e) => e.key !== key)), []);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Viewer
          stream={{ id: stream.id, status: stream.status, last_seen_at: stream.last_seen_at }}
          overlay={<DonationAlert queue={queue} onShown={onShown} />}
        />
        {children}
      </div>
      <ChatPanel
        streamId={stream.id}
        ownerId={stream.owner_id}
        viewer={viewer}
        onDonation={onDonation}
        className="h-[420px] lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]"
      />
    </div>
  );
}
