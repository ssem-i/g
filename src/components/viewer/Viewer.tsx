"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
} from "livekit-client";
import { HEARTBEAT_STALE_MS } from "@/lib/live";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Stream } from "@/lib/types";

type Conn = "idle" | "connecting" | "connected" | "error";

interface Props {
  stream: Pick<Stream, "id" | "status" | "last_seen_at">;
  /** 서버 시계로 판단한 최초 라이브 여부 (기기 시계 오차에 영향받지 않도록) */
  serverLive: boolean;
  /** 플레이어 위에 겹쳐 보여줄 요소 (후원 알림 등) */
  overlay?: ReactNode;
  onViewerCount?: (n: number) => void;
}

const isHost = (p: RemoteParticipant) => p.identity.startsWith("host-");

export function Viewer({ stream, serverLive, overlay, onViewerCount }: Props) {
  // ---- 방송 상태 (DB status + 하트비트) ----
  // 기기 시계가 서버와 달라도 동작하도록, last_seen_at 값을 서버 시각과 비교하지 않고
  // "새 하트비트 값을 마지막으로 관측한 로컬 시각(freshAt)"으로 만료를 판단한다.
  const [row, setRow] = useState(stream);
  const [clock, setClock] = useState(() => Date.now());
  const [freshAt, setFreshAt] = useState(() => (serverLive ? Date.now() : 0));
  const live = row.status === "live" && Boolean(row.last_seen_at) && clock - freshAt < HEARTBEAT_STALE_MS;

  // ---- 플레이어 상태 ----
  const [conn, setConn] = useState<Conn>("idle");
  const [connError, setConnError] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [hostPresent, setHostPresent] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [videoBlocked, setVideoBlocked] = useState(false);
  const needsGesture = audioBlocked || videoBlocked;
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [viewers, setViewers] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioBoxRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mutedRef = useRef(false);
  const volumeRef = useRef(1);

  // 방송 상태 실시간 반영 (Supabase Realtime) + 주기적 재조회 (하트비트 만료 감지)
  useEffect(() => {
    const supabase = getBrowserSupabase();
    let lastSeen = stream.last_seen_at;
    const accept = (n: Props["stream"]) => {
      if (n.status === "live" && n.last_seen_at && n.last_seen_at !== lastSeen) setFreshAt(Date.now());
      lastSeen = n.last_seen_at;
      setRow({ id: n.id, status: n.status, last_seen_at: n.last_seen_at });
      setClock(Date.now());
    };
    const refetch = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("streams")
        .select("id, status, last_seen_at")
        .eq("id", stream.id)
        .maybeSingle();
      if (data) accept(data as Props["stream"]);
    };
    const channel = supabase
      ?.channel(`stream-status-${stream.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "streams", filter: `id=eq.${stream.id}` },
        (payload) => {
          accept(payload.new as Props["stream"]);
        },
      )
      .subscribe();
    const tick = window.setInterval(() => {
      setClock(Date.now());
      void refetch();
    }, HEARTBEAT_STALE_MS / 3);
    return () => {
      window.clearInterval(tick);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [stream.id, stream.last_seen_at]);

  const updateViewers = useCallback(
    (room: Room) => {
      const others = Array.from(room.remoteParticipants.values());
      const n = others.filter((p) => !isHost(p)).length + 1; // + 나
      setViewers(n);
      onViewerCount?.(n);
      setHostPresent(others.some(isHost));
    },
    [onViewerCount],
  );

  const applyAudioSettings = useCallback(() => {
    const box = audioBoxRef.current;
    if (!box) return;
    box.querySelectorAll("audio").forEach((a) => {
      a.muted = mutedRef.current;
      a.volume = volumeRef.current;
    });
  }, []);

  /** 화면 공유 > 카메라 순으로 보여줄 비디오 트랙을 고른다 */
  const pickVideo = useCallback((room: Room) => {
    const el = videoRef.current;
    if (!el) return;
    let chosen: RemoteTrack | null = null;
    for (const p of room.remoteParticipants.values()) {
      const screen = p.getTrackPublication(Track.Source.ScreenShare)?.track;
      const cam = p.getTrackPublication(Track.Source.Camera)?.track;
      const t = (screen && !screen.isMuted ? screen : null) ?? (cam && !cam.isMuted ? cam : null) ?? screen ?? cam;
      if (t) {
        chosen = t;
        break;
      }
    }
    if (chosen) {
      chosen.attach(el);
      setHasVideo(true);
      el.play()
        .then(() => setVideoBlocked(false))
        .catch((e: unknown) => {
          // 트랙을 빠르게 바꿀 때 나는 AbortError 는 차단이 아니다
          if (e instanceof Error && e.name === "AbortError") return;
          setVideoBlocked(true);
        });
    } else {
      el.srcObject = null;
      setHasVideo(false);
    }
  }, []);

  // ---- LiveKit 접속 (방송 중일 때만) ----
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: false });
    roomRef.current = room;

    const refreshAudio = () => {
      const anyAudio = Array.from(room.remoteParticipants.values()).some((p) =>
        Array.from(p.audioTrackPublications.values()).some((pub) => pub.track),
      );
      setHasAudio(anyAudio);
    };

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.muted = mutedRef.current;
          el.volume = volumeRef.current;
          audioBoxRef.current?.appendChild(el);
          refreshAudio();
        } else {
          pickVideo(room);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => el.remove());
          refreshAudio();
        } else {
          track.detach();
          pickVideo(room);
        }
      })
      .on(RoomEvent.TrackMuted, () => pickVideo(room))
      .on(RoomEvent.TrackUnmuted, () => pickVideo(room))
      .on(RoomEvent.TrackPublished, () => pickVideo(room))
      .on(RoomEvent.ParticipantConnected, () => updateViewers(room))
      .on(RoomEvent.ParticipantDisconnected, () => {
        updateViewers(room);
        pickVideo(room);
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
      .on(RoomEvent.VideoPlaybackStatusChanged, () => setVideoBlocked(!room.canPlaybackVideo))
      .on(RoomEvent.Reconnecting, () => setReconnecting(true))
      .on(RoomEvent.Reconnected, () => setReconnecting(false))
      .on(RoomEvent.Disconnected, () => {
        if (cancelled) return;
        setConn("error");
        setConnError("방송 서버와 연결이 끊겼습니다. 네트워크를 확인한 뒤 '다시 연결'을 누르세요.");
      });

    (async () => {
      setConn("connecting");
      setConnError(null);
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamId: stream.id, role: "viewer" }),
        });
        const body = (await res.json().catch(() => ({}))) as { token?: string; url?: string; error?: string };
        if (!res.ok || !body.token || !body.url) throw new Error(body.error ?? "시청 토큰을 받지 못했습니다.");
        if (cancelled) return;
        await room.connect(body.url, body.token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        setConn("connected");
        updateViewers(room);
        pickVideo(room);
        refreshAudio();
        if (!room.canPlaybackAudio) setAudioBlocked(true);
      } catch (e) {
        if (cancelled) return;
        setConn("error");
        const msg = e instanceof Error ? e.message : String(e);
        setConnError(
          /[가-힣]/.test(msg)
            ? msg
            : `방송에 연결하지 못했습니다. 네트워크 연결을 확인하고 '다시 연결'을 누르세요. 회사/학교 망에서는 WebRTC가 차단될 수 있습니다. (${msg})`,
        );
      }
    })();

    const audioBox = audioBoxRef.current;
    return () => {
      cancelled = true;
      roomRef.current = null;
      void room.disconnect();
      if (audioBox) audioBox.innerHTML = "";
      setHasVideo(false);
      setHasAudio(false);
      setHostPresent(false);
      setConn("idle");
      setReconnecting(false);
    };
  }, [live, stream.id, retryKey, pickVideo, updateViewers]);

  // ---- 사용자 조작 ----
  const startPlayback = async () => {
    const room = roomRef.current;
    // 사용자 터치 안에서 소리와 영상 재생을 모두 시작한다
    try {
      await room?.startAudio();
    } catch {
      // 아래에서 상태로 판단
    }
    try {
      await room?.startVideo();
    } catch {
      // 아래 play 로 재시도
    }
    let videoOk = true;
    try {
      if (videoRef.current?.srcObject) await videoRef.current.play();
    } catch (e) {
      videoOk = e instanceof Error && e.name === "AbortError";
    }
    mutedRef.current = false;
    setMuted(false);
    applyAudioSettings();
    setAudioBlocked(Boolean(room && !room.canPlaybackAudio));
    setVideoBlocked(!videoOk);
  };

  const toggleMute = async () => {
    if (needsGesture) return startPlayback();
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    applyAudioSettings();
  };

  const onVolume = (v: number) => {
    volumeRef.current = v;
    setVolume(v);
    if (v > 0 && mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
    }
    applyAudioSettings();
  };

  const toggleFullscreen = async () => {
    const box = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (box?.requestFullscreen) {
        await box.requestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        // iPhone Safari: 요소 전체 화면 미지원 → 비디오 전용 전체 화면
        video.webkitEnterFullscreen();
      }
    } catch {
      video?.webkitEnterFullscreen?.();
    }
  };

  const showPlayer = live && conn === "connected" && hostPresent;

  return (
    <div ref={containerRef} className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        className={`h-full w-full object-contain ${showPlayer && hasVideo ? "" : "invisible"}`}
        playsInline
        autoPlay
        muted // 영상은 항상 음소거, 소리는 별도 audio 요소로 재생
      />
      <div ref={audioBoxRef} className="hidden" aria-hidden />

      {/* 방송 준비 중 */}
      {!live && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-black p-4 text-center">
          <p className="text-3xl" aria-hidden>
            📺
          </p>
          <p className="text-lg font-bold">방송 준비 중</p>
          <p className="text-sm text-muted">스트리머가 방송을 시작하면 자동으로 재생됩니다.</p>
        </div>
      )}

      {/* 연결 중 / 스트리머 대기 */}
      {live && (conn === "connecting" || conn === "idle" || (conn === "connected" && !hostPresent)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-accent" aria-hidden />
          <p className="text-sm text-muted">
            {conn === "connected" ? "스트리머 연결을 기다리는 중… 잠시 후에도 화면이 없으면 방송이 곧 시작됩니다." : "방송에 연결하는 중…"}
          </p>
        </div>
      )}

      {/* 오디오만 송출 중 */}
      {showPlayer && !hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-3xl" aria-hidden>
            🎧
          </p>
          <p className="text-sm text-muted">{hasAudio ? "오디오만 송출 중입니다." : "스트리머가 화면을 잠시 껐습니다."}</p>
        </div>
      )}

      {/* 오류 */}
      {live && conn === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center">
          <p className="max-w-md text-sm text-red-200">{connError}</p>
          <button type="button" className="btn-primary" onClick={() => setRetryKey((k) => k + 1)}>
            다시 연결
          </button>
        </div>
      )}

      {/* 자동 재생 차단 시 */}
      {showPlayer && needsGesture && (
        <button
          type="button"
          onClick={startPlayback}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 text-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-3xl text-accent-ink">▶</span>
          <span className="text-base font-bold">눌러서 시청 시작</span>
          <span className="text-xs text-muted">브라우저 정책으로 소리 자동 재생이 막혀 있습니다.</span>
        </button>
      )}

      {overlay}

      {/* 상단 정보 */}
      {live && (
        <div className="pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[11px] font-extrabold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
          </span>
          {conn === "connected" && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white" aria-label={`현재 시청자 ${viewers}명`}>
              👁 {viewers.toLocaleString("ko-KR")}명
            </span>
          )}
          {reconnecting && <span className="rounded bg-yellow-500/80 px-1.5 py-0.5 text-[11px] text-black">재연결 중…</span>}
        </div>
      )}

      {/* 하단 컨트롤 */}
      {showPlayer && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-md bg-black/50 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-black/70"
            aria-label={muted || needsGesture ? "음소거 해제" : "음소거"}
          >
            {muted || needsGesture ? "🔇 음소거 해제" : "🔊 음소거"}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="hidden w-24 accent-[var(--accent)] sm:block"
            aria-label="볼륨"
          />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="ml-auto rounded-md bg-black/50 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-black/70"
            aria-label="전체 화면"
          >
            ⛶ 전체 화면
          </button>
        </div>
      )}
    </div>
  );
}
