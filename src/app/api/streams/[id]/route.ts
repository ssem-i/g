import { NextResponse } from "next/server";
import { jsonError, parseStreamInput, requireStreamOwner } from "@/lib/server/api";

/** 방송 수정 — 소유자만 (비소유자 403, DB RLS 도 이중으로 차단) */
export async function PATCH(request: Request, ctx: RouteContext<"/api/streams/[id]">) {
  const { id } = await ctx.params;
  const owner = await requireStreamOwner(id);
  if (!owner.ok) return owner.response;

  const parsed = parseStreamInput(await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(400, parsed.message);

  const { error } = await owner.supabase.from("streams").update(parsed.value).eq("id", id);
  if (error) return jsonError(500, `방송을 수정하지 못했습니다. (${error.message})`);
  return NextResponse.json({ ok: true });
}

/** 방송 삭제 — 소유자만 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/streams/[id]">) {
  const { id } = await ctx.params;
  const owner = await requireStreamOwner(id);
  if (!owner.ok) return owner.response;

  const { error } = await owner.supabase.from("streams").delete().eq("id", id);
  if (error) return jsonError(500, `방송을 삭제하지 못했습니다. (${error.message})`);
  return NextResponse.json({ ok: true });
}
