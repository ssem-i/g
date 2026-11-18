import type { ReactNode } from "react";

type Tone = "error" | "info" | "warn" | "success";

const toneClass: Record<Tone, string> = {
  error: "border-danger/40 bg-danger/10 text-red-200",
  info: "border-border bg-surface-2 text-foreground",
  warn: "border-yellow-500/40 bg-yellow-500/10 text-yellow-100",
  success: "border-accent/40 bg-accent/10 text-emerald-100",
};

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${toneClass[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1 opacity-90" : ""}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}
