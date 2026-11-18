"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Notice } from "@/components/Notice";
import { dbErrorMessage } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { ChatMessage, Donation } from "@/lib/types";

export interface ChatViewer {
  id: string;
  nickname: string;
}

type FeedItem =
  | { kind: "chat"; id: string; created_at: string; user_id: string; nickname: string; content: string }
  | { kind: "donation"; id: string; created_at: string; user_id: string; nickname: string; amount: number; content: string };

const MAX_ITEMS = 200;

interface Props {
  streamId: string;
  ownerId: string;
  viewer: ChatViewer | null;
  /** 후원이 들어왔을 때 (플레이어 알림 오버레이용) */
  onDonation?: (d: { nickname: string; amount: number; message: string }) => void;
  className?: string;
}

export function ChatPanel({ streamId, ownerId, viewer, onDonation, className = "" }: Props) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const nickCache = useRef(new Map<string, string>());
  const onDonationRef = useRef(onDonation);
  useEffect(() => {
    onDonationRef.current = onDonation;
  }, [onDonation]);

  const isOwner = viewer?.id === ownerId;

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const cache = nickCache.current;

    const nicknameOf = async (userId: string) => {
      const hit = cache.get(userId);
      if (hit) return hit;
      const { data } = await supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle();
      const nick = (data?.nickname as string | undefined) ?? "알 수 없음";
      cache.set(userId, nick);
      return nick;
    };

    const add = (item: FeedItem) =>
      setItems((prev) => {
        if (prev.some((p) => p.kind === item.kind && p.id === item.id)) return prev;
        const next = [...prev, item].sort((a, b) => a.created_at.localeCompare(b.created_at));
        return next.slice(-MAX_ITEMS);
      });

    (async () => {
      const [chat, don] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("id, user_id, content, created_at, author:profiles!chat_messages_user_id_fkey(nickname)")
          .eq("stream_id", streamId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("donations")
          .select("id, from_user_id, amount, message, created_at, donor:profiles!donations_from_user_id_fkey(nickname)")
          .eq("stream_id", streamId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;
      if (chat.error || don.error) {
        setLoadError(dbErrorMessage(chat.error?.message ?? don.error?.message));
        setLoading(false);
        return;
      }
      type Nick = { nickname: string } | { nickname: string }[] | null;
      const nick = (a: Nick) => (Array.isArray(a) ? a[0]?.nickname : a?.nickname) ?? "알 수 없음";
      const loaded: FeedItem[] = [
        ...(chat.data ?? []).map((m) => {
          const n = nick(m.author as Nick);
          cache.set(m.user_id, n);
          return { kind: "chat" as const, id: m.id, created_at: m.created_at, user_id: m.user_id, nickname: n, content: m.content };
        }),
        ...(don.data ?? []).map((d) => ({
          kind: "donation" as const,
          id: d.id,
          created_at: d.created_at,
          user_id: d.from_user_id,
          nickname: nick(d.donor as Nick),
          amount: d.amount,
          content: d.message,
        })),
      ].sort((a, b) => a.created_at.localeCompare(b.created_at));
      setItems(loaded.slice(-MAX_ITEMS));
      setLoading(false);
    })();

    const channel = supabase
      .channel(`stream-feed-${streamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const m = payload.new as ChatMessage;
          const n = await nicknameOf(m.user_id);
          add({ kind: "chat", id: m.id, created_at: m.created_at, user_id: m.user_id, nickname: n, content: m.content });
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setItems((prev) => prev.filter((p) => !(p.kind === "chat" && p.id === id)));
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "donations", filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const d = payload.new as Donation;
          const n = await nicknameOf(d.from_user_id);
          add({
            kind: "donation",
            id: d.id,
            created_at: d.created_at,
            user_id: d.from_user_id,
            nickname: n,
            amount: d.amount,
            content: d.message,
          });
          onDonationRef.current?.({ nickname: n, amount: d.amount, message: d.message });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnected(false);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, streamId]);

  // 새 메시지가 오면 맨 아래로 (사용자가 위로 스크롤해 읽는 중이면 유지)
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !viewer) return;
    const content = text.trim();
    if (!content) return;
    if (content.length > 300) {
      setSendError("채팅은 300자까지 입력할 수 있습니다.");
      return;
    }
    setSending(true);
    setSendError(null);
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ stream_id: streamId, user_id: viewer.id, content })
      .select("id, created_at")
      .single();
    setSending(false);
    if (error) {
      setSendError(dbErrorMessage(error.message));
      return;
    }
    setText("");
    stickToBottom.current = true;
    // Realtime 이 늦거나 끊겨도 내 메시지는 바로 보이도록
    nickCache.current.set(viewer.id, viewer.nickname);
    setItems((prev) =>
      prev.some((p) => p.kind === "chat" && p.id === data.id)
        ? prev
        : [...prev, { kind: "chat" as const, id: data.id, created_at: data.created_at, user_id: viewer.id, nickname: viewer.nickname, content }].slice(-MAX_ITEMS),
    );
  }

  async function remove(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) {
      setSendError(dbErrorMessage(error.message));
      return;
    }
    setItems((prev) => prev.filter((p) => !(p.kind === "chat" && p.id === id)));
  }

  return (
    <section className={`card flex min-h-0 flex-col ${className}`} aria-label="실시간 채팅">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-bold">실시간 채팅</h2>
        {!connected && <span className="text-xs text-yellow-300">실시간 연결 끊김 · 재연결 중</span>}
      </header>

      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3 text-sm">
        {!supabase && <p className="text-muted">서버 설정이 완료되지 않아 채팅을 불러올 수 없습니다.</p>}
        {loading && supabase && <p className="text-muted">채팅을 불러오는 중…</p>}
        {loadError && <Notice tone="error">{loadError}</Notice>}
        {!loading && !loadError && items.length === 0 && (
          <p className="py-6 text-center text-muted">아직 채팅이 없습니다. 첫 메시지를 남겨 보세요!</p>
        )}
        {items.map((item) =>
          item.kind === "donation" ? (
            <div key={`d-${item.id}`} className="rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2">
              <p className="font-bold text-yellow-200">
                💎 {item.nickname}님이 {item.amount.toLocaleString("ko-KR")}P 후원!
              </p>
              {item.content && <p className="mt-0.5 break-words text-foreground">{item.content}</p>}
            </div>
          ) : (
            <div key={`c-${item.id}`} className="group flex items-start gap-1.5 break-words leading-relaxed">
              <p className="min-w-0 flex-1">
                {item.user_id === ownerId && (
                  <span className="mr-1 rounded bg-accent px-1 py-px text-[10px] font-extrabold text-accent-ink">스트리머</span>
                )}
                <span className={`mr-1.5 font-semibold ${item.user_id === ownerId ? "text-accent" : "text-sky-300"}`}>
                  {item.nickname}
                </span>
                <span>{item.content}</span>
              </p>
              {(isOwner || item.user_id === viewer?.id) && (
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="shrink-0 rounded px-1 text-xs text-muted opacity-100 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="채팅 삭제"
                  title="삭제"
                >
                  삭제
                </button>
              )}
            </div>
          ),
        )}
      </div>

      <div className="border-t border-border p-3">
        {viewer ? (
          <form onSubmit={send} className="flex gap-2">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              placeholder="채팅을 입력하세요"
              aria-label="채팅 입력"
              disabled={!supabase}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={sending || !text.trim()}>
              전송
            </button>
          </form>
        ) : (
          <p className="text-center text-sm text-muted">
            채팅은 로그인 후 참여할 수 있습니다.{" "}
            <Link href={`/login?next=/streams/${streamId}`} className="text-accent hover:underline">
              로그인
            </Link>
          </p>
        )}
        {sendError && <p className="mt-2 text-xs text-red-300">{sendError}</p>}
      </div>
    </section>
  );
}
