"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbErrorMessage } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** 다시보기 삭제 (소유자만: Storage 정책 + recordings RLS 로 이중 보호) */
export function DeleteRecordingButton({
  recordingId,
  storagePath,
  redirectTo,
  small,
}: {
  recordingId: string;
  storagePath: string;
  redirectTo?: string;
  small?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    if (!window.confirm("이 다시보기를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setPending(true);
    const { data, error } = await supabase.from("recordings").delete().eq("id", recordingId).select("id");
    if (error || !data?.length) {
      setPending(false);
      window.alert(error ? dbErrorMessage(error.message) : "권한이 없습니다. 다시보기 소유자 계정으로 로그인하세요.");
      return;
    }
    await supabase.storage.from("recordings").remove([storagePath]);
    setPending(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={small ? "rounded px-2 py-1 text-xs text-muted hover:bg-danger/20 hover:text-danger" : "btn-danger"}
    >
      {pending ? "삭제 중…" : "삭제"}
    </button>
  );
}
