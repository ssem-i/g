import Link from "next/link";
import { ConfigMissing } from "@/components/ConfigMissing";
import { EmptyState, Notice } from "@/components/Notice";
import { OwnerActions } from "@/components/OwnerActions";
import { LiveBadge } from "@/components/StreamCard";
import { formatDate, isEffectivelyLive } from "@/lib/live";
import { requirePageUser } from "@/lib/server/auth";
import { sortLiveFirst } from "@/lib/server/data";
import { STREAM_SELECT, type Recording, type StreamWithOwner } from "@/lib/types";
import { RECORDING_SELECT, RecordingList } from "@/components/recording/RecordingList";

export const metadata = { title: "스튜디오 — LiveOn" };

type One<T> = T | T[] | null;
interface ReceivedDonation {
  id: string;
  amount: number;
  message: string;
  created_at: string;
  stream: One<{ id: string; title: string; owner_id: string }>;
  donor: One<{ nickname: string }>;
}
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

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

  // 받은 후원 내역: 내 방송에 들어온 후원 (streams!inner 로 소유자 필터)
  const { data: donations, error: donationError } = await supabase
    .from("donations")
    .select(
      "id, amount, message, created_at, stream:streams!inner(id, title, owner_id), donor:profiles!donations_from_user_id_fkey(nickname)",
    )
    .eq("stream.owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ReceivedDonation[]>();
  const donationTotal = (donations ?? []).reduce((sum, d) => sum + d.amount, 0);
  const { data: myRecordings } = await supabase
    .from("recordings")
    .select(RECORDING_SELECT)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<Recording[]>();
  const { data: me } = await supabase.from("profiles").select("points").eq("id", user.id).maybeSingle();

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

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">받은 후원</h2>
          <p className="text-sm text-muted">
            최근 50건 합계 <span className="font-bold text-yellow-300">{donationTotal.toLocaleString("ko-KR")}P</span>
            {me && <> · 내 보유 포인트 {(me.points as number).toLocaleString("ko-KR")}P</>}
          </p>
        </div>
        {donationError && (
          <Notice tone="error" title="후원 내역을 불러오지 못했습니다">
            새로고침해 주세요. ({donationError.message})
          </Notice>
        )}
        {!donationError && (donations ?? []).length === 0 ? (
          <EmptyState title="아직 받은 후원이 없습니다">시청자가 방송 페이지에서 후원하면 여기에 표시됩니다.</EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">일시</th>
                  <th className="px-4 py-2 font-medium">후원자</th>
                  <th className="px-4 py-2 font-medium">금액</th>
                  <th className="px-4 py-2 font-medium">메시지</th>
                  <th className="px-4 py-2 font-medium">방송</th>
                </tr>
              </thead>
              <tbody>
                {(donations ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-muted">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-2">{one(d.donor)?.nickname ?? "알 수 없음"}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-yellow-300">{d.amount.toLocaleString("ko-KR")}P</td>
                    <td className="max-w-[16rem] break-words px-4 py-2">{d.message || <span className="text-muted">-</span>}</td>
                    <td className="max-w-[12rem] truncate px-4 py-2">
                      <Link href={`/streams/${one(d.stream)?.id}`} className="hover:text-accent">
                        {one(d.stream)?.title}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">내 다시보기</h2>
        <RecordingList recordings={myRecordings ?? []} viewerId={user.id} />
      </section>
    </div>
  );
}
