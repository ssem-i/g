// 환경 변수 접근을 한곳에 모은다. 값이 없어도 빌드는 통과해야 하므로
// 여기서는 절대 throw 하지 않고, 호출하는 쪽에서 "설정 필요" 상태를 보여준다.

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Supabase 신규 프로젝트는 anon key 대신 publishable key(sb_publishable_...)를 준다. 둘 다 허용.
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function isLivekitPublicConfigured(): boolean {
  return Boolean(publicEnv.livekitUrl);
}

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "서버 설정이 아직 완료되지 않았습니다. 관리자는 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수를 설정한 뒤 다시 배포하세요.";
