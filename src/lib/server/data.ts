import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isEffectivelyLive } from "@/lib/live";
import { STREAM_SELECT, type StreamWithOwner } from "@/lib/types";

export async function fetchStream(
  supabase: SupabaseClient,
  id: string,
): Promise<{ stream: StreamWithOwner | null; error: string | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { stream: null, error: null };
  const { data, error } = await supabase
    .from("streams")
    .select(STREAM_SELECT)
    .eq("id", id)
    .maybeSingle<StreamWithOwner>();
  return { stream: data ?? null, error: error?.message ?? null };
}

/** 라이브 중인 방송을 먼저, 그다음 최신 순으로 정렬 */
export function sortLiveFirst(streams: StreamWithOwner[]): StreamWithOwner[] {
  const now = Date.now();
  return [...streams].sort((a, b) => {
    const la = isEffectivelyLive(a, now) ? 1 : 0;
    const lb = isEffectivelyLive(b, now) ? 1 : 0;
    if (la !== lb) return lb - la;
    const ta = new Date(a.started_at ?? a.created_at).getTime();
    const tb = new Date(b.started_at ?? b.created_at).getTime();
    return tb - ta;
  });
}
