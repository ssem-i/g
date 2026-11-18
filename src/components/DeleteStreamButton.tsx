"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteStreamButton({ streamId, redirectTo = "/studio" }: { streamId: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (!window.confirm("이 방송을 삭제할까요? 채팅과 후원 기록도 함께 삭제되며 되돌릴 수 없습니다.")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/streams/${streamId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(body.error ?? "삭제하지 못했습니다. 잠시 후 다시 시도하세요.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      window.alert("네트워크 오류로 삭제하지 못했습니다. 인터넷 연결을 확인하세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={pending} className="btn-danger">
      {pending ? "삭제 중…" : "삭제"}
    </button>
  );
}
