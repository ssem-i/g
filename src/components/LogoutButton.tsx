"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setPending(true);
    await supabase.auth.signOut();
    setPending(false);
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={onClick} disabled={pending} className="btn-secondary px-3 py-1.5">
      {pending ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
