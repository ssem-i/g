import type { Metadata } from "next";
import { ConfigMissing } from "@/components/ConfigMissing";
import { NotFoundCard } from "@/components/Forbidden";
import { EmptyState } from "@/components/Notice";
import { StreamGrid } from "@/components/StreamCard";
import { sortLiveFirst } from "@/lib/server/data";
import { getServerSupabase } from "@/lib/supabase/server";
import { STREAM_SELECT, type Profile, type StreamWithOwner } from "@/lib/types";

export const metadata: Metadata = { title: "채널 — LiveOn" };

export default async function ChannelPage({ params }: PageProps<"/channel/[id]">) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  if (!supabase) return <ConfigMissing />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <NotFoundCard message="채널을 찾을 수 없습니다." />;

  const [{ data: profile }, { data: streams }] = await Promise.all([
    supabase.from("profiles").select("id, nickname, created_at").eq("id", id).maybeSingle<Pick<Profile, "id" | "nickname" | "created_at">>(),
    supabase
      .from("streams")
      .select(STREAM_SELECT)
      .eq("owner_id", id)
      .order("created_at", { ascending: false })
      .returns<StreamWithOwner[]>(),
  ]);
  if (!profile) return <NotFoundCard message="채널을 찾을 수 없습니다." />;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
          {profile.nickname.slice(0, 1)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile.nickname}</h1>
          <p className="text-sm text-muted">방송 {streams?.length ?? 0}개</p>
        </div>
      </header>
      <section>
        <h2 className="mb-3 text-lg font-bold">방송</h2>
        {streams && streams.length ? (
          <StreamGrid streams={sortLiveFirst(streams)} />
        ) : (
          <EmptyState title="아직 방송이 없습니다" />
        )}
      </section>
    </div>
  );
}
