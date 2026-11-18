"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AudioPresets,
  createLocalAudioTrack,
  createLocalScreenTracks,
  createLocalVideoTrack,
  DisconnectReason,
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  VideoPresets,
  type LocalTrack,
  type TrackPublishOptions,
} from "livekit-client";
import { Notice } from "@/components/Notice";
import { getDeviceInfo, getServerDeviceInfo, subscribeNoop } from "@/lib/device";
import { mediaErrorMessage } from "@/lib/errors";
import { formatDuration, HEARTBEAT_INTERVAL_MS } from "@/lib/live";
import type { Stream } from "@/lib/types";
import { workerInterval } from "@/lib/worker-timer";

type Mode = "screen" | "camera";
type Phase = "idle" | "connecting" | "live" | "ending";
type Facing = "user" | "environment";
/** 트랙 상태: 없음(off) / 송출(on) / 일시 음소거(muted) */
type TrackState = "off" | "on" | "muted";

export const TAB_AUDIO_TIP = "Chrome에서 탭 공유 시 '탭 오디오 공유'를 체크하세요";

const CAMERA_RESOLUTION = VideoPresets.h720.resolution;

function stateOf(track: LocalTrack | null): TrackState {
  if (!track) return "off";
  return track.isMuted ? "muted" : "on";
}

export interface BroadcasterProps {
  stream: Pick<Stream, "id" | "title">;
  /** 녹화 기능(선택)에서 송출 스트림을 받아 가기 위한 훅 */
  onLiveStart?: (api: BroadcastMediaApi) => void;
  onLiveEnd?: () => Promise<void> | void;
}

/** 녹화 모듈이 현재 송출 중인 트랙을 조회하는 인터페이스 */
export interface BroadcastMediaApi {
  getVideoTrack: () => MediaStreamTrack | null;
  getAudioTracks: () => MediaStreamTrack[];
}

export function Broadcaster({ stream, onLiveStart, onLiveEnd }: BroadcasterProps) {
  // ---- 기기 감지 (마운트 후에만 navigator 접근) ----
  const device = useSyncExternalStore(subscribeNoop, getDeviceInfo, getServerDeviceInfo);
  // 사용자가 고른 모드. 고르기 전에는 기기에 맞는 기본값(화면 공유 가능 → screen, 아니면 camera)
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (device?.screen ? "screen" : "camera");

  // ---- 트랙 상태 (UI 표시용) ----
  const [screenOn, setScreenOn] = useState(false);
  const [tabAudio, setTabAudio] = useState<TrackState>("off");
  const [mic, setMic] = useState<TrackState>("off");
  const [camera, setCamera] = useState<TrackState>("off");
  const [facing, setFacing] = useState<Facing>("user");
  const [busy, setBusy] = useState<string | null>(null);

  // ---- 방송 상태 ----
  const [phase, setPhase] = useState<Phase>("idle");
  const [viewerCount, setViewerCount] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ---- 실제 트랙/룸 객체 ----
  const roomRef = useRef<Room | null>(null);
  const screenVideoRef = useRef<LocalVideoTrack | null>(null);
  const screenAudioRef = useRef<LocalAudioTrack | null>(null);
  const micRef = useRef<LocalAudioTrack | null>(null);
  const cameraRef = useRef<LocalVideoTrack | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const stopHeartbeatRef = useRef<(() => void) | null>(null);
  const liveRef = useRef(false);
  const mountedRef = useRef(true);
  const pendingFacingRef = useRef<Facing | null>(null);
  const endingRef = useRef(false);
  const modeRef = useRef<Mode>("screen");
  const [previewVersion, setPreviewVersion] = useState(0);
  const bumpPreview = () => setPreviewVersion((v) => v + 1);

  const statusUrl = `/api/streams/${stream.id}/status`;

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // 경과 시간 표시
  useEffect(() => {
    if (phase !== "live") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // ---- 미리보기: 현재 모드의 비디오 트랙을 video 태그에 붙인다 ----
  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;
    const track = mode === "screen" ? screenVideoRef.current : cameraRef.current;
    if (track) {
      track.attach(el);
      el.muted = true;
      el.play().catch(() => {});
      return () => {
        track.detach(el);
      };
    }
    el.srcObject = null;
  }, [mode, previewVersion]);

  // ---- 송출 중이면 룸에 publish / unpublish ----
  const publishIfLive = useCallback(async (track: LocalTrack, options: TrackPublishOptions) => {
    const room = roomRef.current;
    if (!room || !liveRef.current) return;
    await room.localParticipant.publishTrack(track, options);
  }, []);

  const unpublishIfLive = useCallback(async (track: LocalTrack) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.unpublishTrack(track, false);
    } catch {
      // 이미 unpublish 된 경우 무시
    }
  }, []);

  // ======================= 화면 공유 =======================
  const stopScreen = useCallback(async () => {
    const v = screenVideoRef.current;
    const a = screenAudioRef.current;
    screenVideoRef.current = null;
    screenAudioRef.current = null;
    for (const t of [v, a]) {
      if (!t) continue;
      await unpublishIfLive(t);
      t.stop();
    }
    setScreenOn(false);
    setTabAudio("off");
    bumpPreview();
  }, [unpublishIfLive]);

  const startScreen = useCallback(async () => {
    setError(null);
    setWarning(null);
    setBusy("screen");
    try {
      await stopScreen();
      const tracks = await createLocalScreenTracks({
        audio: true, // 탭/시스템 오디오
        systemAudio: "include",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        contentHint: "detail",
      });
      const video = tracks.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      const audio = tracks.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;
      if (!video) {
        tracks.forEach((t) => t.stop());
        setError("화면 영상을 가져오지 못했습니다. 다시 시도하세요.");
        return;
      }
      screenVideoRef.current = video;
      screenAudioRef.current = audio ?? null;
      // 브라우저의 "공유 중지" 버튼을 누르면 정리
      video.on(TrackEvent.Ended, () => {
        void stopScreen();
        setWarning("화면 공유가 중지되었습니다. 다시 공유하려면 '화면 공유' 버튼을 누르세요.");
      });
      audio?.on(TrackEvent.Ended, () => {
        screenAudioRef.current = null;
        setTabAudio("off");
      });
      setScreenOn(true);
      setTabAudio(audio ? "on" : "off");
      if (!audio) {
        setWarning(
          `소리가 공유되지 않았습니다. 화면 공유를 다시 시작하고 ${TAB_AUDIO_TIP}. (창/전체 화면 공유는 Windows Chrome에서만 '시스템 오디오 공유'가 가능합니다.)`,
        );
      }
      bumpPreview();
      await publishIfLive(video, { source: Track.Source.ScreenShare });
      if (audio) {
        await publishIfLive(audio, {
          source: Track.Source.ScreenShareAudio,
          audioPreset: AudioPresets.musicHighQualityStereo,
          dtx: false,
          red: false,
        });
      }
    } catch (e) {
      setError(mediaErrorMessage(e, "screen"));
    } finally {
      setBusy(null);
    }
  }, [publishIfLive, stopScreen]);

  const toggleScreen = () => (screenVideoRef.current ? stopScreen() : startScreen());

  const toggleTabAudio = async () => {
    const a = screenAudioRef.current;
    if (!a) {
      setWarning(
        screenVideoRef.current
          ? `현재 공유 중인 화면에 소리가 없습니다. '화면 공유'를 껐다가 다시 켜고 ${TAB_AUDIO_TIP}.`
          : `먼저 '화면 공유'를 켜세요. ${TAB_AUDIO_TIP}.`,
      );
      return;
    }
    if (a.isMuted) await a.unmute();
    else await a.mute();
    setTabAudio(stateOf(a));
  };

  // ======================= 마이크 =======================
  const toggleMic = async () => {
    setError(null);
    const m = micRef.current;
    if (m) {
      if (m.isMuted) await m.unmute();
      else await m.mute();
      setMic(stateOf(m));
      return;
    }
    setBusy("mic");
    try {
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      micRef.current = track;
      track.on(TrackEvent.Ended, () => {
        if (micRef.current !== track) return;
        micRef.current = null;
        // LiveKit 이 자동 재시작해 publish 상태로 남지 않도록 직접 내리고 장치를 해제
        void unpublishIfLive(track).finally(() => track.stop());
        setMic("off");
        setWarning("마이크 연결이 끊겼습니다. 장치를 확인한 뒤 '마이크' 버튼을 다시 누르세요.");
      });
      setMic("on");
      await publishIfLive(track, { source: Track.Source.Microphone });
    } catch (e) {
      setError(mediaErrorMessage(e, "mic"));
    } finally {
      setBusy(null);
    }
  };

  // ======================= 카메라 (모바일/PC 웹캠) =======================
  const stopCamera = useCallback(async () => {
    const c = cameraRef.current;
    cameraRef.current = null;
    if (c) {
      await unpublishIfLive(c);
      c.stop();
    }
    setCamera("off");
    bumpPreview();
  }, [unpublishIfLive]);

  const startCamera = async (face: Facing = facing) => {
    setError(null);
    setBusy("camera");
    try {
      const track = await createLocalVideoTrack({ facingMode: face, resolution: CAMERA_RESOLUTION });
      cameraRef.current = track;
      track.on(TrackEvent.Ended, () => {
        if (cameraRef.current !== track) return;
        cameraRef.current = null;
        void unpublishIfLive(track).finally(() => track.stop());
        setCamera("off");
        bumpPreview();
        setWarning("카메라 연결이 끊겼습니다. 다른 앱이 카메라를 쓰고 있지 않은지 확인한 뒤 다시 켜세요.");
      });
      setCamera("on");
      bumpPreview();
      await publishIfLive(track, { source: Track.Source.Camera });
    } catch (e) {
      setError(mediaErrorMessage(e, "camera"));
    } finally {
      setBusy(null);
    }
  };

  const toggleCamera = async () => {
    const c = cameraRef.current;
    if (!c) return startCamera();
    if (c.isMuted) {
      await c.unmute();
      // 일시정지 중에 전환을 눌렀다면 다시 켤 때 적용
      if (pendingFacingRef.current) {
        const face = pendingFacingRef.current;
        pendingFacingRef.current = null;
        try {
          await c.restartTrack({ facingMode: face, resolution: CAMERA_RESOLUTION });
          bumpPreview();
        } catch (e) {
          setError(mediaErrorMessage(e, "camera"));
        }
      }
    } else await c.mute();
    setCamera(stateOf(c));
  };

  const flipCamera = async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    const c = cameraRef.current;
    if (!c || c.isMuted) {
      // 카메라가 꺼져 있으면 장치를 켜지 않고 다음에 켤 때 적용한다
      if (c) pendingFacingRef.current = next;
      setFacing(next);
      return;
    }
    setBusy("flip");
    setError(null);
    try {
      await c.restartTrack({ facingMode: next, resolution: CAMERA_RESOLUTION });
      setFacing(next);
      bumpPreview();
    } catch (e) {
      setError(
        `카메라를 전환하지 못했습니다. 이 기기에 ${next === "user" ? "전면" : "후면"} 카메라가 없을 수 있습니다. (${mediaErrorMessage(e, "camera")})`,
      );
    } finally {
      setBusy(null);
    }
  };

  // ---- 모드 전환 (송출 전에만) ----
  const switchMode = async (next: Mode) => {
    if (next === mode || liveRef.current) return;
    setError(null);
    setWarning(null);
    if (next === "camera") await stopScreen();
    else await stopCamera();
    modeRef.current = next;
    setChosenMode(next);
  };

  // ======================= 방송 시작/종료 =======================
  const stopHeartbeat = () => {
    stopHeartbeatRef.current?.();
    stopHeartbeatRef.current = null;
  };

  const sendStatus = useCallback(
    (action: "start" | "heartbeat" | "end") =>
      fetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        keepalive: true,
      }),
    [statusUrl],
  );

  const mediaApi: BroadcastMediaApi = {
    getVideoTrack: () =>
      (modeRef.current === "screen" ? screenVideoRef.current : cameraRef.current)?.mediaStreamTrack ?? null,
    getAudioTracks: () =>
      [screenAudioRef.current, micRef.current]
        .filter((t): t is LocalAudioTrack => Boolean(t))
        .map((t) => t.mediaStreamTrack),
  };

  const finishLive = useCallback(
    async (opts: { notifyServer: boolean }) => {
      if (endingRef.current) return;
      endingRef.current = true;
      setPhase("ending");
      stopHeartbeat();
      liveRef.current = false;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) await room.disconnect(false); // 로컬 트랙은 유지 → 미리보기 계속
      if (opts.notifyServer) {
        try {
          await sendStatus("end");
        } catch {
          // 하트비트 만료로 결국 offline 처리된다
        }
      }
      setPhase("idle");
      setStartedAt(null);
      setViewerCount(0);
      setReconnecting(false);
      endingRef.current = false;
      // 녹화 정지/업로드는 방송 종료 처리 뒤에 진행 (시청자에게는 즉시 종료로 보임)
      try {
        await onLiveEnd?.();
      } catch {
        // 녹화 업로드 실패는 녹화 모듈이 따로 안내한다
      }
    },
    [onLiveEnd, sendStatus],
  );

  /** 지금 켜져 있는 트랙 목록 (연결 직후 시점의 ref 기준으로 다시 계산한다) */
  const currentTracks = (): Array<[LocalTrack, TrackPublishOptions]> => {
    const m = modeRef.current;
    const tracks: Array<[LocalTrack, TrackPublishOptions]> = [];
    const video = m === "screen" ? screenVideoRef.current : cameraRef.current;
    if (video) tracks.push([video, { source: m === "screen" ? Track.Source.ScreenShare : Track.Source.Camera }]);
    if (m === "screen" && screenAudioRef.current)
      tracks.push([
        screenAudioRef.current,
        { source: Track.Source.ScreenShareAudio, audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: false },
      ]);
    if (micRef.current) tracks.push([micRef.current, { source: Track.Source.Microphone }]);
    return tracks;
  };

  const goLive = async () => {
    setError(null);
    setWarning(null);
    setInfo(null);
    if (currentTracks().length === 0) {
      setError(
        mode === "screen"
          ? "송출할 화면이나 마이크가 없습니다. '화면 공유' 또는 '마이크'를 먼저 켜세요."
          : "송출할 카메라나 마이크가 없습니다. '카메라' 또는 '마이크'를 먼저 켜세요.",
      );
      return;
    }

    setPhase("connecting");
    let room: Room | null = null;
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: stream.id, role: "publisher" }),
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; url?: string; error?: string };
      if (!res.ok || !body.token || !body.url) {
        setError(body.error ?? "방송 토큰을 받지 못했습니다. 잠시 후 다시 시도하세요.");
        setPhase("idle");
        return;
      }

      room = new Room({ adaptiveStream: false, dynacast: true, stopLocalTrackOnUnpublish: false });
      const r = room;
      const updateCount = () => setViewerCount(r.remoteParticipants.size);
      r.on(RoomEvent.ParticipantConnected, updateCount)
        .on(RoomEvent.ParticipantDisconnected, updateCount)
        .on(RoomEvent.Reconnecting, () => setReconnecting(true))
        .on(RoomEvent.Reconnected, () => setReconnecting(false))
        .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          if (!liveRef.current || endingRef.current) return;
          setError(
            reason === DisconnectReason.DUPLICATE_IDENTITY
              ? "다른 탭이나 기기에서 같은 방송을 송출하기 시작해 이 화면의 송출이 종료되었습니다."
              : "방송 서버와 연결이 끊겼습니다. 네트워크를 확인한 뒤 '방송 시작'을 다시 누르세요.",
          );
          // 다른 탭이 같은 방송을 이어받은 경우 end 를 보내면 새 방송을 offline 으로 만들어 버린다
          void finishLive({ notifyServer: reason !== DisconnectReason.DUPLICATE_IDENTITY });
        });

      if (!mountedRef.current) return;
      await r.connect(body.url, body.token);
      // 4. 연결 중에 페이지를 떠났다면 여기서 중단 (cleanup 이 이미 실행됨)
      if (!mountedRef.current) {
        await r.disconnect(true);
        return;
      }
      roomRef.current = r;
      liveRef.current = true;
      for (const [t, opts] of currentTracks()) await r.localParticipant.publishTrack(t, opts);
      updateCount();

      const statusRes = await sendStatus("start");
      if (!mountedRef.current) return;
      if (!statusRes.ok) {
        const sb = (await statusRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(sb.error ?? "방송 상태를 live 로 바꾸지 못했습니다.");
      }
      stopHeartbeatRef.current = workerInterval(() => {
        void sendStatus("heartbeat")
          .then((hr) => {
            if (hr.status === 403 || hr.status === 404) {
              setError("방송이 삭제되었거나 권한이 없어 송출을 종료합니다.");
              void finishLive({ notifyServer: false });
            }
          })
          .catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);

      setStartedAt(Date.now());
      setPhase("live");
      setInfo("방송이 시작되었습니다. '시청 페이지 열기'로 다른 기기에서 확인해 보세요.");
      onLiveStart?.(mediaApi);
    } catch (e) {
      liveRef.current = false;
      roomRef.current = null;
      if (room) await room.disconnect(false);
      setError(
        `방송 서버에 연결하지 못했습니다. 네트워크 연결을 확인하고 다시 시도하세요. 회사/학교 망이라면 WebRTC가 차단되었을 수 있습니다. (${
          e instanceof Error ? e.message : String(e)
        })`,
      );
      setPhase("idle");
    }
  };

  // ---- 비정상 종료 대비: 탭 닫기/새로고침/이동 ----
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!liveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onPageHide = () => {
      if (!liveRef.current) return;
      // 페이지가 사라져도 전송되는 sendBeacon 으로 offline 처리
      navigator.sendBeacon(statusUrl, new Blob([JSON.stringify({ action: "end" })], { type: "text/plain" }));
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [statusUrl]);

  // 컴포넌트가 사라질 때(다른 페이지로 이동) 송출 종료 + 장치 해제
  useEffect(() => {
    const refs = { screenVideoRef, screenAudioRef, micRef, cameraRef };
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopHeartbeatRef.current?.();
      if (liveRef.current) {
        liveRef.current = false;
        void fetch(statusUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end" }),
          keepalive: true,
        }).catch(() => {});
      }
      void roomRef.current?.disconnect(true);
      for (const r of Object.values(refs)) {
        r.current?.stop();
        r.current = null;
      }
    };
  }, [statusUrl]);

  // ======================= UI =======================
  if (!device) {
    return <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-2" aria-label="불러오는 중" />;
  }

  const live = phase === "live";
  const hasPreview = mode === "screen" ? screenOn : camera !== "off";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        {/* 상태 바 */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {live ? (
            <span className="inline-flex items-center gap-1 rounded bg-live px-2 py-0.5 text-xs font-extrabold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
            </span>
          ) : (
            <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
              {phase === "connecting" ? "연결 중…" : phase === "ending" ? "종료 중…" : "미리보기 (송출 전)"}
            </span>
          )}
          {live && startedAt && <span className="tabular-nums text-muted">{formatDuration((now - startedAt) / 1000)}</span>}
          {live && <span className="text-muted">시청자 {viewerCount}명</span>}
          {reconnecting && <span className="text-yellow-300">재연결 중…</span>}
          <Link href={`/streams/${stream.id}`} target="_blank" className="ml-auto text-accent hover:underline">
            시청 페이지 열기 ↗
          </Link>
        </div>

        {/* 미리보기 */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <video
            ref={videoElRef}
            className={`h-full w-full object-contain ${mode === "camera" && facing === "user" ? "-scale-x-100" : ""}`}
            playsInline
            muted
            autoPlay
          />
          {!hasPreview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted">
              <p className="text-base font-semibold text-foreground">미리보기</p>
              <p>
                {mode === "screen"
                  ? "아래 '화면 공유' 버튼을 눌러 공유할 화면이나 탭을 선택하세요."
                  : "아래 '카메라' 버튼을 눌러 카메라를 켜세요. 처음에는 권한 허용 창이 뜹니다."}
              </p>
            </div>
          )}
          {mode === "screen" && screenOn && camera === "off" && (
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-muted">
              내 화면 미리보기 (시청자에게 보이는 화면)
            </span>
          )}
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        {warning && <Notice tone="warn">{warning}</Notice>}
        {info && !error && <Notice tone="success">{info}</Notice>}
      </div>

      {/* 컨트롤 패널 */}
      <aside className="card space-y-4 p-4">
        <div>
          <p className="text-xs text-muted">방송</p>
          <p className="truncate font-semibold">{stream.title}</p>
        </div>

        {device.screen ? (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="송출 방식">
            {(
              [
                ["screen", "🖥 화면 공유"],
                ["camera", "📷 카메라"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                disabled={live || phase === "connecting"}
                onClick={() => switchMode(m)}
                className={`rounded-md px-2 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                  mode === m ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            {device.mobile ? "모바일 기기가 감지되어 카메라 송출 모드로 동작합니다." : "이 브라우저는 화면 공유를 지원하지 않아 카메라 모드로 동작합니다."}
          </p>
        )}

        {/* 연결/종료 처리 중에는 트랙 조작을 잠가 publish 목록과 어긋나지 않게 한다 */}
        <fieldset className="space-y-2 disabled:opacity-60" disabled={phase === "connecting" || phase === "ending"}>
          {mode === "screen" ? (
            <>
              <ControlButton
                icon="🖥"
                label="화면 공유"
                state={screenOn ? "on" : "off"}
                busy={busy === "screen"}
                onClick={toggleScreen}
              />
              <ControlButton
                icon="🔊"
                label="소리 공유 (탭/시스템 오디오)"
                state={tabAudio}
                onClick={toggleTabAudio}
                offText={screenOn ? "소리 없음" : "꺼짐"}
              />
            </>
          ) : (
            <>
              {device.camera ? (
                <>
                  <ControlButton icon="📷" label="카메라" state={camera} busy={busy === "camera"} onClick={toggleCamera} />
                  <button
                    type="button"
                    onClick={flipCamera}
                    disabled={busy === "flip"}
                    className="btn-secondary w-full justify-between"
                  >
                    <span>🔄 카메라 전환</span>
                    <span className="text-xs text-muted">
                      {busy === "flip" ? "전환 중…" : facing === "user" ? "현재: 전면" : "현재: 후면"}
                    </span>
                  </button>
                </>
              ) : (
                <Notice tone="warn">
                  이 브라우저는 카메라를 지원하지 않습니다. iOS는 Safari, Android는 Chrome에서 HTTPS 주소로 접속하세요.
                </Notice>
              )}
            </>
          )}
          <ControlButton icon="🎤" label="마이크" state={mic} busy={busy === "mic"} onClick={toggleMic} />
        </fieldset>

        {mode === "screen" && (
          <Notice tone="info" title="소리 공유 안내">
            <p>{TAB_AUDIO_TIP}</p>
            <p className="mt-1 text-xs text-muted">
              창/전체 화면 공유는 Windows Chrome에서 &apos;시스템 오디오 공유&apos;로 소리를 보낼 수 있습니다. macOS는 탭 공유만 소리를 지원합니다.
            </p>
          </Notice>
        )}

        {live ? (
          <button
            type="button"
            className="btn-danger w-full py-3 text-base"
            onClick={() => finishLive({ notifyServer: true })}
          >
            방송 종료
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary w-full py-3 text-base"
            disabled={phase !== "idle"}
            onClick={goLive}
          >
            {phase === "connecting" ? "연결 중…" : phase === "ending" ? "종료 처리 중…" : "방송 시작"}
          </button>
        )}
        <p className="text-xs text-muted">
          송출 중에도 각 버튼으로 켜고 끌 수 있습니다. 탭을 닫으면 방송은 자동으로 종료(offline)됩니다.
        </p>
      </aside>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  state,
  onClick,
  busy,
  offText = "꺼짐",
}: {
  icon: string;
  label: string;
  state: TrackState;
  onClick: () => void;
  busy?: boolean;
  offText?: string;
}) {
  const text = busy ? "준비 중…" : state === "on" ? "켜짐" : state === "muted" ? "꺼짐(일시정지)" : offText;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={state === "on"}
      className={`btn w-full justify-between border ${
        state === "on" ? "border-accent/60 bg-accent/15 text-foreground" : "border-border bg-surface-2 text-foreground hover:bg-border"
      }`}
    >
      <span>
        {icon} {label}
      </span>
      <span className={`text-xs font-bold ${state === "on" ? "text-accent" : "text-muted"}`}>● {text}</span>
    </button>
  );
}
