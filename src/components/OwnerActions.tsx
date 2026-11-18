import Link from "next/link";
import { DeleteStreamButton } from "@/components/DeleteStreamButton";

/** 방송 소유자에게만 렌더링되는 관리 버튼 (호출하는 쪽에서 소유자 여부를 확인) */
export function OwnerActions({ streamId, live }: { streamId: string; live: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/studio/${streamId}/broadcast`} className="btn-primary">
        {live ? "송출 화면으로" : "송출 시작"}
      </Link>
      <Link href={`/studio/${streamId}/edit`} className="btn-secondary">
        수정
      </Link>
      <DeleteStreamButton streamId={streamId} />
    </div>
  );
}
