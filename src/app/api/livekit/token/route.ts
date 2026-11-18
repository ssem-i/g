import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { roomNameFor } from "@/lib/live";
import { jsonError, requireStreamOwner } from "@/lib/server/api";
import { isLivekitServerConfigured, serverEnv } from "@/lib/server-env";
import { getCurrentUser, getServerSupabase } from "@/lib/supabase/server";

const LIVEKIT_NOT_CONFIGURED =
  "방송 서버(LiveKit) 설정이 완료되지 않았습니다. 관리자는 NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET 환경 변수를 설정하세요.";

function randomSuffix() {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * LiveKit 접속 토큰 발급.
 *  - role "publisher": 세션을 검증해 방송 소유자에게만 canPublish 토큰을 준다. 비소유자는 403.
 *  - role "viewer": 로그인 없이 시청 가능. 구독(canSubscribe)만 허용, 송출 권한 없음.
 */
export async function POST(request: Request) {
  if (!isLivekitServerConfigured()) return jsonError(503, LIVEKIT_NOT_CONFIGURED);

  const body = (await request.json().catch(() => null)) as { streamId?: unknown; role?: unknown } | null;
  const streamId = typeof body?.streamId === "string" ? body.streamId : "";
  const role = body?.role === "publisher" ? "publisher" : "viewer";
  if (!/^[0-9a-f-]{36}$/i.test(streamId)) return jsonError(400, "방송 ID가 올바르지 않습니다.");

  const room = roomNameFor(streamId);
  let identity: string;
  let name: string;
  let canPublish = false;

  if (role === "publisher") {
    const owner = await requireStreamOwner(streamId);
    if (!owner.ok) return owner.response; // 401 / 403 / 404
    const { data: profile } = await owner.supabase
      .from("profiles")
      .select("nickname")
      .eq("id", owner.user.id)
      .maybeSingle();
    identity = `host-${owner.user.id}`;
    name = profile?.nickname ?? "스트리머";
    canPublish = true;
  } else {
    const supabase = await getServerSupabase();
    if (!supabase) return jsonError(503, "서버 설정이 완료되지 않았습니다.");
    const { data: stream } = await supabase.from("streams").select("id").eq("id", streamId).maybeSingle();
    if (!stream) return jsonError(404, "방송을 찾을 수 없습니다. 삭제되었을 수 있습니다.");
    const user = await getCurrentUser(supabase);
    identity = user ? `viewer-${user.id}-${randomSuffix()}` : `guest-${randomSuffix()}`;
    name = "시청자";
  }

  const at = new AccessToken(serverEnv.livekitApiKey, serverEnv.livekitApiSecret, {
    identity,
    name,
    ttl: "6h",
    metadata: JSON.stringify({ role }),
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: false,
  });

  return NextResponse.json({
    token: await at.toJwt(),
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    room,
    identity,
  });
}
