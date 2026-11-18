"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Notice } from "@/components/Notice";
import { dbErrorMessage } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";

const PRESETS = [1000, 5000, 10000];

interface Props {
  streamId: string;
  loggedIn: boolean;
  isOwner: boolean;
  initialPoints: number | null;
}

/** 가상 포인트 후원. 차감/적립은 DB 함수 donate() 가 한 트랜잭션으로 처리한다. */
export function DonateForm({ streamId, loggedIn, isOwner, initialPoints }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [message, setMessage] = useState("");
  const [points, setPoints] = useState(initialPoints);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (isOwner) return null;

  if (!loggedIn) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
        <span>💎 로그인하면 가입 포인트 10,000P로 스트리머를 후원할 수 있어요.</span>
        <Link href={`/login?next=/streams/${streamId}`} className="btn-primary">
          로그인하고 후원
        </Link>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!Number.isInteger(amount) || amount < 100) {
      setError("후원 금액은 100P 이상 정수로 입력하세요.");
      return;
    }
    if (points !== null && amount > points) {
      setError(`포인트가 부족합니다. 현재 ${points.toLocaleString("ko-KR")}P 보유 중입니다. 금액을 줄여 주세요.`);
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setPending(true);
    const { data, error } = await supabase.rpc("donate", {
      p_stream_id: streamId,
      p_amount: amount,
      p_message: message.trim(),
    });
    setPending(false);
    if (error) {
      setError(dbErrorMessage(error.message));
      return;
    }
    setPoints(typeof data === "number" ? data : null);
    setDone(`${amount.toLocaleString("ko-KR")}P를 후원했습니다! 남은 포인트: ${typeof data === "number" ? data.toLocaleString("ko-KR") : "-"}P`);
    setMessage("");
    router.refresh(); // 헤더 포인트 갱신
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          💎 후원하기{" "}
          {points !== null && <span className="ml-1 text-xs font-normal text-muted">보유 {points.toLocaleString("ko-KR")}P</span>}
        </p>
        <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "닫기" : "후원"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={`rounded-full border px-3 py-1 text-sm ${amount === p ? "border-accent bg-accent/15 text-accent" : "border-border text-muted"}`}
              >
                {p.toLocaleString("ko-KR")}P
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              min={100}
              step={100}
              className="input w-32"
              value={amount}
              onChange={(e) => setAmount(Math.floor(Number(e.target.value)))}
              aria-label="후원 금액(포인트)"
            />
          </div>
          <input
            className="input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={100}
            placeholder="응원 메시지 (선택, 100자)"
            aria-label="후원 메시지"
          />
          {error && <Notice tone="error">{error}</Notice>}
          {done && <Notice tone="success">{done}</Notice>}
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? "후원 중…" : `${(amount || 0).toLocaleString("ko-KR")}P 후원하기`}
          </button>
          <p className="text-xs text-muted">실제 결제가 아닌 가상 포인트입니다.</p>
        </form>
      )}
    </div>
  );
}
