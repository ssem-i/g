import Link from "next/link";
import { EmptyState } from "@/components/Notice";
import { DeleteRecordingButton } from "@/components/recording/DeleteRecordingButton";
import { formatDate, formatDuration } from "@/lib/live";
import type { Recording } from "@/lib/types";

export const RECORDING_SELECT = "id, stream_id, owner_id, storage_path, duration, title, created_at";

export function RecordingList({
  recordings,
  viewerId,
  emptyText = "아직 다시보기가 없습니다.",
}: {
  recordings: Recording[];
  viewerId?: string | null;
  emptyText?: string;
}) {
  if (!recordings.length) {
    return (
      <EmptyState title={emptyText}>스트리머가 녹화를 켠 채 방송을 종료하면 자동으로 저장됩니다.</EmptyState>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
      {recordings.map((r) => (
        <li key={r.id} className="card flex flex-col gap-2 p-3">
          <Link href={`/recordings/${r.id}`} className="group block">
            <div className="relative flex aspect-video items-center justify-center rounded-lg bg-surface-2">
              <span className="text-2xl text-muted group-hover:text-accent" aria-hidden>
                ▶
              </span>
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums">
                {formatDuration(r.duration)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold group-hover:text-accent">{r.title || "제목 없음"}</p>
          </Link>
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>{formatDate(r.created_at)}</span>
            {viewerId === r.owner_id && <DeleteRecordingButton recordingId={r.id} storagePath={r.storage_path} small />}
          </div>
        </li>
      ))}
    </ul>
  );
}
