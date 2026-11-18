"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Notice } from "@/components/Notice";
import { CATEGORIES } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  streamId?: string;
  initial?: { title: string; description: string; category: string };
}

export function StreamForm({ mode, streamId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(mode === "create" ? "/api/streams" : `/api/streams/${streamId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? "저장하지 못했습니다. 잠시 후 다시 시도하세요.");
        return;
      }
      const id = mode === "create" ? body.id : streamId;
      router.push(mode === "create" ? `/studio/${id}/broadcast` : `/streams/${id}`);
      router.refresh();
    } catch {
      setError("네트워크 오류로 저장하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5 sm:p-6">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">제목</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          required
          placeholder="예: 저녁 코딩 라이브"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">카테고리</span>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {!CATEGORIES.includes(category as (typeof CATEGORIES)[number]) && <option value={category}>{category}</option>}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">설명</span>
        <textarea
          className="input min-h-28"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder="방송 내용을 소개해 주세요."
        />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          취소
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "저장 중…" : mode === "create" ? "등록하고 송출 화면으로" : "수정 저장"}
        </button>
      </div>
    </form>
  );
}
