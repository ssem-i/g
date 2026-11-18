import Link from "next/link";
import type { Metadata } from "next";
import { ConfigMissing } from "@/components/ConfigMissing";
import { Viewer } from "@/components/viewer/Viewer";
import { NotFoundCard } from "@/components/Forbidden";
import { Notice } from "@/components/Notice";
import { OwnerActions } from "@/components/OwnerActions";
import { LiveBadge } from "@/components/StreamCard";
import { isEffectivelyLive } from "@/lib/live";
import { fetchStream } from "@/lib/server/data";
import { getCurrentUser, getServerSupabase } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/streams/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await getServerSupabase();
  if (!supabase) return { title: "LiveOn" };
  const { stream } = await fetchStream(supabase, id);
  return { title: stream ? `${stream.title} — LiveOn` : "방송 없음 — LiveOn" };
}

export default async function StreamPage({ params }: PageProps<"/streams/[id]">) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  if (!supabase) return <ConfigMissing />;

  const [{ stream, error }, user] = await Promise.all([fetchStream(supabase, id), getCurrentUser(supabase)]);
  if (error)
    return (
      <Notice tone="error" title="방송 정보를 불러오지 못했습니다">
        네트워크 상태를 확인하고 새로고침하세요. ({error})
      </Notice>
    );
  if (!stream) return <NotFoundCard />;

  const isOwner = user?.id === stream.owner_id;
  const live = isEffectivelyLive(stream);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Viewer stream={{ id: stream.id, status: stream.status, last_seen_at: stream.last_seen_at }} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {live && <LiveBadge />}
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">{stream.category}</span>
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">{stream.title}</h1>
          <Link href={`/channel/${stream.owner_id}`} className="text-sm text-muted hover:text-accent">
            {stream.owner?.nickname ?? "알 수 없음"}
          </Link>
          {stream.description && <p className="whitespace-pre-wrap text-sm text-foreground/90">{stream.description}</p>}
          {isOwner && <OwnerActions streamId={stream.id} live={live} />}
        </div>
      </div>
    </div>
  );
}
