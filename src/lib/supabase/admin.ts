import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * service_role 키를 쓰는 관리자 클라이언트 (RLS 우회).
 * 서버 전용이며, LiveKit 웹훅처럼 사용자 세션이 없는 곳에서만 사용한다.
 */
export function getAdminSupabase(): SupabaseClient | null {
  if (!publicEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) return null;
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
