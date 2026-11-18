import Link from "next/link";
import { ConfigMissing } from "@/components/ConfigMissing";
import { NotFoundCard } from "@/components/Forbidden";
import { DeleteRecordingButton } from "@/components/recording/DeleteRecordingButton";
import { RECORDING_SELECT } from "@/components/recording/RecordingList";
import { formatDate, formatDuration } from "@/lib/live";
import { getCurrentUser, getServerSupabase } from "@/lib/supabase/server";
import type { Recording } from "@/lib/types";

export const metadata = { title: "다시보기 — LiveOn" };

export default async function RecordingPage({ params }: PageProps<"/recordings/[id]">) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  if (!supabase) return <ConfigMissing />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <NotFoundCard message="다시보기를 찾을 수 없습니다." />;

  const [{ data: rec }, user] = await Promise.all([
    supabase.from("recordings").select(RECORDING_SELECT).eq("id", id).maybeSingle<Recording>(),
    getCurrentUser(supabase),
  ]);
  if (!rec) return <NotFoundCard message="다시보기를 찾을 수 없습니다." />;

  const { data: owner } = await supabase.from("profiles").select("nickname").eq("id", rec.owner_id).maybeSingle();
  const url = supabase.storage.from("recordings").getPublicUrl(rec.storage_path).data.publicUrl;
  const isOwner = user?.id === rec.owner_id;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-xl bg-black"
      >
        이 브라우저는 영상 재생을 지원하지 않습니다.
      </video>
      <p className="text-xs text-muted">
        재생되지 않으면 최신 Chrome/Edge/Firefox로 열어 주세요. (PC Chrome에서 녹화된 WebM 파일은 일부 구형 iOS Safari에서 재생되지 않을 수 있습니다.)
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-accent">다시보기</p>
          <h1 className="text-xl font-bold sm:text-2xl">{rec.title || "제목 없음"}</h1>
          <p className="mt-1 text-sm text-muted">
            <Link href={`/channel/${rec.owner_id}`} className="hover:text-accent">
              {(owner?.nickname as string | undefined) ?? "알 수 없음"}
            </Link>{" "}
            · {formatDate(rec.created_at)} · {formatDuration(rec.duration)}
          </p>
        </div>
        <div className="flex gap-2">
          {rec.stream_id && (
            <Link href={`/streams/${rec.stream_id}`} className="btn-secondary">
              방송 페이지
            </Link>
          )}
          {isOwner && (
            <DeleteRecordingButton recordingId={rec.id} storagePath={rec.storage_path} redirectTo={`/channel/${rec.owner_id}`} />
          )}
        </div>
      </div>
    </div>
  );
}
