import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * 요청 사용자의 세션(쿠키)으로 동작하는 서버용 Supabase 클라이언트.
 * RLS 가 그대로 적용된다. 환경 변수가 없으면 null.
 */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  // 쿠키를 먼저 읽어 페이지를 항상 동적 렌더링으로 만든다 (사용자별 화면).
  const cookieStore = await cookies();
  if (!isSupabaseConfigured()) return null;
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component 에서는 쿠키를 쓸 수 없다. proxy.ts 가 세션을 갱신한다.
        }
      },
    },
  });
}

/** 서버에서 Supabase Auth 서버에 검증된 현재 사용자를 가져온다. */
export async function getCurrentUser(
  supabase: SupabaseClient | null,
): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
