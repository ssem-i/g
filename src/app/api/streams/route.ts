import { NextResponse } from "next/server";
import { jsonError, parseStreamInput, requireUser } from "@/lib/server/api";

/** 방송 등록 (로그인 필요). owner_id 는 서버에서 세션 사용자로 강제한다. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = parseStreamInput(await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(400, parsed.message);

  const { data, error } = await auth.supabase
    .from("streams")
    .insert({ ...parsed.value, owner_id: auth.user.id })
    .select("id")
    .single();
  if (error) return jsonError(500, `방송을 등록하지 못했습니다. 잠시 후 다시 시도하세요. (${error.message})`);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
