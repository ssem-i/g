import { NextResponse } from "next/server";
import { jsonError, requireStreamOwner } from "@/lib/server/api";

/**
 * 방송 상태 변경 — 소유자만.
 *  - start: live 로 전환 (started_at, last_seen_at 기록)
 *  - heartbeat: 송출 중 주기적으로 last_seen_at 갱신 (끊기면 비정상 종료로 판단)
 *  - end: offline 으로 전환
 * 탭을 닫을 때는 navigator.sendBeacon 으로 end 를 보낸다 (본문은 text/plain JSON).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/streams/[id]/status">) {
  const { id } = await ctx.params;
  const owner = await requireStreamOwner(id);
  if (!owner.ok) return owner.response;

  let action = "";
  try {
    const body = JSON.parse(await request.text()) as { action?: unknown };
    action = typeof body.action === "string" ? body.action : "";
  } catch {
    return jsonError(400, "요청 형식이 올바르지 않습니다.");
  }

  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (action === "start") patch = { status: "live", started_at: now, last_seen_at: now };
  else if (action === "heartbeat") patch = { status: "live", last_seen_at: now };
  else if (action === "end") patch = { status: "offline", last_seen_at: null };
  else return jsonError(400, "action 은 start, heartbeat, end 중 하나여야 합니다.");

  // heartbeat 가 종료 직후 늦게 도착해 다시 live 로 되돌리는 것을 막는다.
  let query = owner.supabase.from("streams").update(patch).eq("id", id);
  if (action === "heartbeat") query = query.eq("status", "live");
  const { error } = await query;
  if (error) return jsonError(500, `방송 상태를 바꾸지 못했습니다. (${error.message})`);
  return NextResponse.json({ ok: true, action });
}
