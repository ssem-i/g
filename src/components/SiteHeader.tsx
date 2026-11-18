import Link from "next/link";
import { getCurrentUser, getServerSupabase } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";

export async function SiteHeader() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser(supabase);
  let nickname: string | null = null;
  let points: number | null = null;
  if (supabase && user) {
    const { data } = await supabase
      .from("profiles")
      .select("nickname, points")
      .eq("id", user.id)
      .maybeSingle();
    nickname = data?.nickname ?? user.email ?? null;
    points = data?.points ?? null;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          LiveOn
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link href="/studio" className="btn-primary px-3 py-1.5">
                스튜디오
              </Link>
              <Link
                href={`/channel/${user.id}`}
                className="hidden max-w-[10rem] truncate text-muted hover:text-foreground sm:inline"
                title="내 채널"
              >
                {nickname}
              </Link>
              {points !== null && (
                <span className="hidden rounded-md bg-surface-2 px-2 py-1 text-xs text-accent md:inline">
                  {points.toLocaleString("ko-KR")} P
                </span>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary px-3 py-1.5">
                로그인
              </Link>
              <Link href="/signup" className="btn-primary px-3 py-1.5">
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
