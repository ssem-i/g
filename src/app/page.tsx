import Link from "next/link";
import { ConfigMissing } from "@/components/ConfigMissing";
import { EmptyState, Notice } from "@/components/Notice";
import { StreamGrid } from "@/components/StreamCard";
import { splitLive } from "@/lib/server/data";
import { getServerSupabase } from "@/lib/supabase/server";
import { STREAM_SELECT, type StreamWithOwner } from "@/lib/types";

export default async function Home() {
  const supabase = await getServerSupabase();
  if (!supabase) return <ConfigMissing />;

  const { data, error } = await supabase
    .from("streams")
    .select(STREAM_SELECT)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<StreamWithOwner[]>();

  const { live, offline } = splitLive(data ?? []);

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-gradient-to-r from-accent/15 via-surface to-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold sm:text-2xl">지금, 바로 방송하세요</h1>
          <p className="mt-1 text-sm text-muted">
            PC는 화면·탭 소리·마이크, 모바일은 카메라로 송출합니다. 시청은 로그인 없이 가능합니다.
          </p>
        </div>
        <Link href="/studio/new" className="btn-primary">
          방송 만들기
        </Link>
      </section>

      {error && (
        <Notice tone="error" title="방송 목록을 불러오지 못했습니다">
          네트워크 상태를 확인하고 새로고침하세요. 계속되면 관리자에게 schema.sql 실행 여부를 확인해 주세요. ({error.message})
        </Notice>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <span className="h-2 w-2 rounded-full bg-live" aria-hidden /> 라이브 중 <span className="text-muted">{live.length}</span>
        </h2>
        {live.length ? (
          <StreamGrid streams={live} />
        ) : (
          <EmptyState title="지금 라이브 중인 방송이 없습니다">
            스튜디오에서 방송을 만들고 송출을 시작해 보세요.
          </EmptyState>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">
          전체 방송 <span className="text-muted">{offline.length}</span>
        </h2>
        {offline.length ? (
          <StreamGrid streams={offline} />
        ) : (
          !error && <EmptyState title="등록된 방송이 없습니다">첫 방송을 만들어 보세요.</EmptyState>
        )}
      </section>
    </div>
  );
}
