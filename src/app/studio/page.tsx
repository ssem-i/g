import Link from "next/link";
import { ConfigMissing } from "@/components/ConfigMissing";
import { EmptyState, Notice } from "@/components/Notice";
import { OwnerActions } from "@/components/OwnerActions";
import { LiveBadge } from "@/components/StreamCard";
import { formatDate, isEffectivelyLive } from "@/lib/live";
import { requirePageUser } from "@/lib/server/auth";
import { sortLiveFirst } from "@/lib/server/data";
import { STREAM_SELECT, type StreamWithOwner } from "@/lib/types";

export const metadata = { title: "스튜디오 — LiveOn" };

export default async function StudioPage() {
  const { supabase, user } = await requirePageUser("/studio");
  if (!supabase) return <ConfigMissing />;

  const { data, error } = await supabase
    .from("streams")
    .select(STREAM_SELECT)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .returns<StreamWithOwner[]>();
  const streams = sortLiveFirst(data ?? []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">스튜디오</h1>
          <p className="text-sm text-muted">내 방송을 만들고, 송출하고, 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/channel/${user.id}`} className="btn-secondary">
            내 채널
          </Link>
          <Link href="/studio/new" className="btn-primary">
            + 새 방송
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">내 방송</h2>
        {error && (
          <Notice tone="error" title="내 방송을 불러오지 못했습니다">
            새로고침해 주세요. ({error.message})
          </Notice>
        )}
        {!error && streams.length === 0 && (
          <EmptyState title="아직 만든 방송이 없습니다">
            <Link href="/studio/new" className="text-accent hover:underline">
              새 방송 만들기
            </Link>
            로 시작하세요.
          </EmptyState>
        )}
        <ul className="space-y-3">
          {streams.map((s) => {
            const live = isEffectivelyLive(s);
            return (
              <li key={s.id} className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {live ? <LiveBadge /> : <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">OFFLINE</span>}
                    <span className="text-xs text-muted">{s.category}</span>
                  </div>
                  <Link href={`/streams/${s.id}`} className="mt-1 block truncate font-semibold hover:text-accent">
                    {s.title}
                  </Link>
                  <p className="text-xs text-muted">만든 날짜 {formatDate(s.created_at)}</p>
                </div>
                <OwnerActions streamId={s.id} live={live} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
