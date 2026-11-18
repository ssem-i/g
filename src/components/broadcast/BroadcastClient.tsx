"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Broadcaster, type BroadcastMediaApi } from "@/components/broadcast/Broadcaster";
import { ChatPanel, type ChatViewer } from "@/components/chat/ChatPanel";
import { Notice } from "@/components/Notice";
import { dbErrorMessage } from "@/lib/errors";
import { formatDuration } from "@/lib/live";
import { BroadcastRecorder, isRecordingSupported, type RecordingResult } from "@/lib/recorder";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Stream } from "@/lib/types";

type RecState =
  | { kind: "idle" }
  | { kind: "recording"; since: number }
  | { kind: "uploading" }
  | { kind: "done"; recordingId: string }
  | { kind: "failed"; message: string; retryable?: boolean };

const subscribeNoop = () => () => {};

/** 송출 화면 조립: 송출기 + 다시보기 녹화 + 채팅(스트리머가 보면서 관리) */
export function BroadcastClient({
  stream,
  viewer,
}: {
  stream: Pick<Stream, "id" | "title" | "owner_id">;
  viewer: ChatViewer;
}) {
  const supported = useSyncExternalStore(subscribeNoop, isRecordingSupported, () => false);
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [rec, setRec] = useState<RecState>({ kind: "idle" });
  const [warn, setWarn] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const recorderRef = useRef<BroadcastRecorder | null>(null);
  const pendingRef = useRef<RecordingResult | null>(null);
  const recordEnabledRef = useRef(recordEnabled);
  useEffect(() => {
    recordEnabledRef.current = recordEnabled;
  }, [recordEnabled]);

  useEffect(() => {
    if (rec.kind !== "recording") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rec.kind]);

  useEffect(() => () => recorderRef.current?.dispose(), []);

  const upload = useCallback(
    async (result: RecordingResult) => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setRec({ kind: "failed", message: "서버 설정이 없어 다시보기를 저장하지 못했습니다." });
        return;
      }
      setRec({ kind: "uploading" });
      const path = `${viewer.id}/${stream.id}/${Date.now()}.${result.ext}`;
      const { error: upErr } = await supabase.storage
        .from("recordings")
        .upload(path, result.blob, { contentType: result.mimeType, upsert: false });
      if (upErr) {
        pendingRef.current = result;
        setRec({
          kind: "failed",
          message: `녹화 파일 업로드에 실패했습니다. 네트워크를 확인하고 '다시 업로드'를 누르세요. (${upErr.message})`,
          retryable: true,
        });
        return;
      }
      const { data, error } = await supabase
        .from("recordings")
        .insert({
          stream_id: stream.id,
          owner_id: viewer.id,
          storage_path: path,
          duration: result.durationSec,
          title: stream.title,
        })
        .select("id")
        .single();
      if (error) {
        await supabase.storage.from("recordings").remove([path]);
        pendingRef.current = result;
        setRec({ kind: "failed", message: `다시보기 정보를 저장하지 못했습니다. (${dbErrorMessage(error.message)})`, retryable: true });
        return;
      }
      pendingRef.current = null;
      setRec({ kind: "done", recordingId: data.id });
    },
    [stream.id, stream.title, viewer.id],
  );

  const onLiveStart = useCallback((api: BroadcastMediaApi) => {
    setWarn(null);
    if (!recordEnabledRef.current || !isRecordingSupported()) return;
    const r = new BroadcastRecorder(api);
    r.onTruncated = () =>
      setWarn("녹화 용량 한도(약 48MB)에 도달해 이후 부분은 녹화되지 않습니다. 방송은 계속됩니다.");
    recorderRef.current = r;
    r.start()
      .then(() => setRec({ kind: "recording", since: Date.now() }))
      .catch((e: unknown) => {
        recorderRef.current = null;
        setRec({ kind: "failed", message: `녹화를 시작하지 못했습니다. 방송은 정상 송출됩니다. (${e instanceof Error ? e.message : String(e)})` });
      });
  }, []);

  const onLiveEnd = useCallback(async () => {
    const r = recorderRef.current;
    recorderRef.current = null;
    if (!r) return;
    const result = await r.stop();
    if (!result || result.durationSec < 1) {
      setRec({ kind: "idle" });
      return;
    }
    await upload(result);
  }, [upload]);

  const download = () => {
    const r = pendingRef.current;
    if (!r) return;
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stream.title}.${r.ext}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="space-y-4">
      <Broadcaster stream={stream} onLiveStart={onLiveStart} onLiveEnd={onLiveEnd} />

      <section className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="font-semibold">📼 다시보기 녹화</span>
        {supported ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recordEnabled}
              disabled={rec.kind === "recording" || rec.kind === "uploading"}
              onChange={(e) => setRecordEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            방송 시작 시 자동 녹화하고 종료 시 업로드
          </label>
        ) : (
          <span className="text-muted">이 브라우저는 녹화를 지원하지 않습니다. (방송은 정상 송출됩니다)</span>
        )}
        <span className="ml-auto">
          {rec.kind === "recording" && (
            <span className="font-bold text-live">● REC {formatDuration((now - rec.since) / 1000)}</span>
          )}
          {rec.kind === "uploading" && <span className="text-yellow-300">업로드 중… 페이지를 닫지 마세요</span>}
          {rec.kind === "done" && (
            <Link href={`/recordings/${rec.recordingId}`} className="text-accent hover:underline">
              다시보기 저장 완료 → 보기
            </Link>
          )}
        </span>
        {rec.kind === "failed" && (
          <div className="w-full space-y-2">
            <Notice tone="error">{rec.message}</Notice>
            {rec.retryable && (
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => pendingRef.current && upload(pendingRef.current)}>
                  다시 업로드
                </button>
                <button type="button" className="btn-secondary" onClick={download}>
                  내 PC에 저장
                </button>
              </div>
            )}
          </div>
        )}
        {warn && (
          <div className="w-full">
            <Notice tone="warn">{warn}</Notice>
          </div>
        )}
        <p className="w-full text-xs text-muted">
          녹화는 이 브라우저에서 진행되며 &apos;방송 종료&apos;를 눌러야 저장됩니다. 탭을 그냥 닫으면 녹화는 저장되지 않습니다. 파일당 약 48MB(약 10분)까지 저장됩니다.
        </p>
      </section>

      <ChatPanel streamId={stream.id} ownerId={stream.owner_id} viewer={viewer} className="h-[380px]" />
    </div>
  );
}
