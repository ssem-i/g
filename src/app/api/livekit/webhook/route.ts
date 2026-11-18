import { WebhookReceiver } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * LiveKit Cloud 웹훅 (선택 설정). 스트리머가 탭을 닫거나 네트워크가 끊겨
 * 방에서 나가면 방송을 offline 으로 되돌린다. 서명을 검증하므로 위조 요청은 거부된다.
 * 웹훅을 설정하지 않아도 하트비트 만료로 offline 처리된다 (src/lib/live.ts).
 */
export async function POST(request: Request) {
  if (!serverEnv.livekitApiKey || !serverEnv.livekitApiSecret) {
    return NextResponse.json({ error: "LiveKit 설정이 없습니다." }, { status: 503 });
  }
  const receiver = new WebhookReceiver(serverEnv.livekitApiKey, serverEnv.livekitApiSecret);
  let event;
  try {
    event = await receiver.receive(await request.text(), request.headers.get("authorization") ?? undefined);
  } catch {
    return NextResponse.json({ error: "웹훅 서명이 올바르지 않습니다." }, { status: 401 });
  }

  const roomName = event.room?.name ?? "";
  const streamId = roomName.startsWith("stream-") ? roomName.slice("stream-".length) : null;
  const hostLeft = event.event === "participant_left" && event.participant?.identity?.startsWith("host-");
  const roomFinished = event.event === "room_finished";

  if (streamId && (hostLeft || roomFinished)) {
    const admin = getAdminSupabase();
    if (admin) {
      await admin.from("streams").update({ status: "offline", last_seen_at: null }).eq("id", streamId);
    }
  }
  return NextResponse.json({ ok: true });
}
