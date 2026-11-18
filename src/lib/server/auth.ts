import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, getServerSupabase } from "@/lib/supabase/server";

/** 로그인 필수 페이지: 비로그인이면 /login?next=... 로 보낸다. 설정 누락 시 supabase=null. */
export async function requirePageUser(nextPath: string) {
  const supabase = await getServerSupabase();
  if (!supabase) return { supabase: null, user: null } as const;
  const user = await getCurrentUser(supabase);
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { supabase, user } as const;
}
