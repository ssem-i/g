import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/env";
import { getCurrentUser, getServerSupabase } from "@/lib/supabase/server";
import type { Stream } from "@/lib/types";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

type AuthOk = { ok: true; supabase: SupabaseClient; user: User };
type Fail = { ok: false; response: NextResponse };

/** 로그인 필수 API 공통 처리: 세션을 Supabase Auth 서버에 검증한다. */
export async function requireUser(): Promise<AuthOk | Fail> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, response: jsonError(503, SUPABASE_NOT_CONFIGURED_MESSAGE) };
  const user = await getCurrentUser(supabase);
  if (!user)
    return {
      ok: false,
      response: jsonError(401, "로그인이 필요합니다. 로그인한 뒤 다시 시도하세요."),
    };
  return { ok: true, supabase, user };
}

/**
 * 방송 소유자만 통과시킨다. 비소유자는 403.
 * (DB 에서도 RLS 가 한 번 더 막지만, API 에서 먼저 명확한 오류를 돌려준다.)
 */
export async function requireStreamOwner(
  streamId: string,
): Promise<(AuthOk & { stream: Stream }) | Fail> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { data, error } = await auth.supabase
    .from("streams")
    .select("*")
    .eq("id", streamId)
    .maybeSingle<Stream>();
  if (error)
    return {
      ok: false,
      response: jsonError(500, "방송 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요."),
    };
  if (!data)
    return { ok: false, response: jsonError(404, "방송을 찾을 수 없습니다. 삭제되었을 수 있습니다.") };
  if (data.owner_id !== auth.user.id)
    return {
      ok: false,
      response: jsonError(403, "이 방송의 소유자만 할 수 있는 작업입니다. 본인 계정으로 로그인했는지 확인하세요."),
    };
  return { ...auth, stream: data };
}

export interface StreamInput {
  title: string;
  description: string;
  category: string;
}

/** 등록/수정 입력 검증. 오류 시 한국어 메시지를 돌려준다. */
export function parseStreamInput(body: unknown): { ok: true; value: StreamInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "요청 형식이 올바르지 않습니다." };
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const category = typeof b.category === "string" ? b.category.trim() : "";
  if (!title || title.length > 100) return { ok: false, message: "제목은 1~100자로 입력하세요." };
  if (description.length > 2000) return { ok: false, message: "설명은 2,000자 이하로 입력하세요." };
  if (!category || category.length > 20) return { ok: false, message: "카테고리를 선택하세요." };
  return { ok: true, value: { title, description, category } };
}
