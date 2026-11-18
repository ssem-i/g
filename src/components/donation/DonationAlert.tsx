"use client";

import { useEffect, useState } from "react";

export interface DonationEvent {
  key: number;
  nickname: string;
  amount: number;
  message: string;
}

/** 플레이어 위에 후원 알림을 하나씩 순서대로 5초간 보여준다 */
export function DonationAlert({ queue, onShown }: { queue: DonationEvent[]; onShown: (key: number) => void }) {
  const current = queue[0];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!current) return;
    const show = window.setTimeout(() => setVisible(true), 30);
    const hide = window.setTimeout(() => setVisible(false), 4600);
    const next = window.setTimeout(() => onShown(current.key), 5000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(next);
    };
  }, [current, onShown]);

  if (!current) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 z-30 flex justify-center px-3" role="status" aria-live="polite">
      <div
        className={`max-w-md rounded-2xl border border-yellow-300/70 bg-gradient-to-r from-yellow-500/90 to-amber-500/90 px-5 py-3 text-center text-black shadow-2xl transition duration-300 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-95 opacity-0"
        }`}
      >
        <p className="text-base font-extrabold sm:text-lg">
          💎 {current.nickname}님 {current.amount.toLocaleString("ko-KR")}P 후원!
        </p>
        {current.message && <p className="mt-0.5 break-words text-sm font-medium">{current.message}</p>}
      </div>
    </div>
  );
}
