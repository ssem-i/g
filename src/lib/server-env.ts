import "server-only";

// 서버 전용 시크릿. 클라이언트 번들에 포함되지 않도록 server-only 로 보호한다.
export const serverEnv = {
  livekitApiKey: process.env.LIVEKIT_API_KEY ?? "",
  livekitApiSecret: process.env.LIVEKIT_API_SECRET ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};

export function isLivekitServerConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_LIVEKIT_URL &&
      serverEnv.livekitApiKey &&
      serverEnv.livekitApiSecret,
  );
}
