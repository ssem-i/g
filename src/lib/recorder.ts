"use client";

import fixWebmDuration from "fix-webm-duration";
import type { BroadcastMediaApi } from "@/components/broadcast/Broadcaster";
import { workerInterval } from "@/lib/worker-timer";

/** Supabase 무료 플랜 파일당 업로드 한도(50MB)보다 약간 작게 자른다 */
export const MAX_RECORDING_BYTES = 48 * 1024 * 1024;

export interface RecordingResult {
  blob: Blob;
  durationSec: number;
  mimeType: string;
  ext: "webm" | "mp4";
  truncated: boolean;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  // MP4(H.264+AAC)를 먼저 쓴다: iPhone Safari 는 Chrome 이 만든 VP9 WebM 을 1~2초 재생 후 멈추는 경우가 있다.
  // MP4 녹화를 지원하지 않는 브라우저(구형 Chrome/Firefox)만 WebM 으로 녹화한다.
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function readType(b: Uint8Array, off: number) {
  return String.fromCharCode(b[off + 4], b[off + 5], b[off + 6], b[off + 7]);
}

/** off..end 범위에서 type 박스를 찾는다 (32비트 크기 박스만; MediaRecorder 출력은 이 형식) */
function findBox(b: Uint8Array, dv: DataView, off: number, end: number, type: string): number {
  while (off + 8 <= end) {
    const size = dv.getUint32(off);
    if (size < 8 || off + size > end) return -1;
    if (readType(b, off) === type) return off;
    off += size;
  }
  return -1;
}

/**
 * MediaRecorder 의 조각(fragmented) MP4 는 전체 길이가 0으로 기록되어
 * Safari 에서 길이 표시·탐색이 안 된다. mvhd 길이를 채우고 mvex 에 mehd(전체 길이) 박스를 넣는다.
 * 조각의 데이터 위치는 moof 기준(default-base-is-moof)이라 moov 크기가 바뀌어도 안전하다.
 */
export function fixMp4Duration(input: ArrayBuffer, durationMs: number): ArrayBuffer | null {
  const b = new Uint8Array(input);
  const dv = new DataView(input);
  const moov = findBox(b, dv, 0, b.length, "moov");
  if (moov < 0) return null;
  const moovEnd = moov + dv.getUint32(moov);
  const mvhd = findBox(b, dv, moov + 8, moovEnd, "mvhd");
  const mvex = findBox(b, dv, moov + 8, moovEnd, "mvex");
  if (mvhd < 0 || mvex < 0) return null;
  const mvexEnd = mvex + dv.getUint32(mvex);
  if (findBox(b, dv, mvex + 8, mvexEnd, "mehd") >= 0) return null; // 이미 길이 정보가 있음

  const v1 = b[mvhd + 8] === 1;
  const timescale = dv.getUint32(mvhd + (v1 ? 28 : 20));
  if (!timescale) return null;
  const units = Math.round((durationMs * timescale) / 1000);
  if (units <= 0 || units > 0xffffffff) return null;

  const out = new Uint8Array(b.length + 16);
  const insertAt = mvex + 8;
  out.set(b.subarray(0, insertAt), 0);
  out.set(b.subarray(insertAt), insertAt + 16);
  const odv = new DataView(out.buffer);
  // mehd (version 0): size, "mehd", version/flags, fragment_duration
  odv.setUint32(insertAt, 16);
  out.set([0x6d, 0x65, 0x68, 0x64], insertAt + 4);
  odv.setUint32(insertAt + 8, 0);
  odv.setUint32(insertAt + 12, units);
  odv.setUint32(moov, dv.getUint32(moov) + 16);
  odv.setUint32(mvex, dv.getUint32(mvex) + 16);
  if (v1) odv.setBigUint64(mvhd + 32, BigInt(units));
  else odv.setUint32(mvhd + 24, units);
  return out.buffer;
}

export function isRecordingSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && pickMimeType() !== "";
}

/**
 * 송출 중인 트랙을 스트리머 브라우저에서 녹화한다.
 * - 영상: 캔버스(1280x720)에 현재 송출 영상을 그려서 녹화 → 송출 중 화면/카메라 전환·끄기에도 녹화가 끊기지 않음
 * - 소리: AudioContext 로 탭 오디오 + 마이크를 하나로 섞어서 녹화
 * - 캔버스/오디오 합성이 불가능한 브라우저는 원본 트랙을 그대로 녹화(폴백)
 */
export class BroadcastRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private bytes = 0;
  private startedAt = 0;
  private stoppedAt = 0;
  private truncated = false;
  private mimeType = "";
  private cleanup: Array<() => void> = [];
  onTruncated?: () => void;

  constructor(private api: BroadcastMediaApi) {}

  get isRecording() {
    return this.recorder?.state === "recording";
  }

  async start(): Promise<void> {
    this.mimeType = pickMimeType();
    if (!this.mimeType) throw new Error("이 브라우저는 녹화(MediaRecorder)를 지원하지 않습니다.");

    let stream: MediaStream;
    try {
      stream = await this.buildCompositeStream();
    } catch {
      const tracks: MediaStreamTrack[] = [];
      const v = this.api.getVideoTrack();
      if (v) tracks.push(v);
      const a = this.api.getAudioTracks()[0];
      if (a) tracks.push(a);
      if (!tracks.length) throw new Error("녹화할 영상/소리가 없습니다.");
      stream = new MediaStream(tracks);
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: this.mimeType,
      videoBitsPerSecond: 600_000,
      audioBitsPerSecond: 96_000,
    });
    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      this.chunks.push(e.data);
      this.bytes += e.data.size;
      if (this.bytes >= MAX_RECORDING_BYTES && recorder.state === "recording") {
        this.truncated = true;
        this.stoppedAt = Date.now();
        recorder.stop();
        this.onTruncated?.();
      }
    };
    this.recorder = recorder;
    this.startedAt = Date.now();
    recorder.start(1000);
  }

  private async buildCompositeStream(): Promise<MediaStream> {
    // --- 영상: 캔버스 합성 ---
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.captureStream !== "function") throw new Error("canvas capture unsupported");
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    let currentVideoId = "";

    const draw = () => {
      const track = this.api.getVideoTrack();
      if (track && track.id !== currentVideoId) {
        currentVideoId = track.id;
        video.srcObject = new MediaStream([track]);
        void video.play().catch(() => {});
      } else if (!track && currentVideoId) {
        currentVideoId = "";
        video.srcObject = null;
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (track && track.enabled && video.videoWidth) {
        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const w = video.videoWidth * scale;
        const h = video.videoHeight * scale;
        ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }
    };
    // Worker 타이머로 그려서 송출 탭이 백그라운드여도 프레임이 이어지도록
    this.cleanup.push(workerInterval(draw, 1000 / 24));
    draw();
    const canvasTrack = canvas.captureStream(24).getVideoTracks()[0];

    // --- 소리: 탭 오디오 + 마이크 믹스 ---
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) throw new Error("AudioContext unsupported");
    const audioCtx = new AC();
    await audioCtx.resume().catch(() => {});
    const dest = audioCtx.createMediaStreamDestination();
    const sources = new Map<string, MediaStreamAudioSourceNode>();
    const syncAudio = () => {
      const tracks = this.api.getAudioTracks().filter((t) => t.readyState === "live");
      const ids = new Set(tracks.map((t) => t.id));
      for (const [id, node] of sources) {
        if (!ids.has(id)) {
          node.disconnect();
          sources.delete(id);
        }
      }
      for (const t of tracks) {
        if (sources.has(t.id)) continue;
        const node = audioCtx.createMediaStreamSource(new MediaStream([t]));
        node.connect(dest);
        sources.set(t.id, node);
      }
    };
    syncAudio();
    this.cleanup.push(workerInterval(syncAudio, 1000));
    this.cleanup.push(() => {
      sources.forEach((n) => n.disconnect());
      void audioCtx.close().catch(() => {});
      video.srcObject = null;
      canvasTrack.stop();
    });

    return new MediaStream([canvasTrack, ...dest.stream.getAudioTracks()]);
  }

  async stop(): Promise<RecordingResult | null> {
    const recorder = this.recorder;
    if (!recorder) return null;
    if (recorder.state !== "inactive") {
      this.stoppedAt = Date.now();
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
    }
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.recorder = null;
    if (!this.chunks.length) return null;

    const durationMs = Math.max(0, (this.stoppedAt || Date.now()) - this.startedAt);
    const baseType = this.mimeType.split(";")[0];
    let blob = new Blob(this.chunks, { type: baseType });
    this.chunks = [];
    const ext = baseType.includes("mp4") ? "mp4" : "webm";
    if (ext === "webm") {
      // MediaRecorder 의 webm 은 길이 정보가 없어 탐색이 안 되므로 보정
      try {
        blob = await fixWebmDuration(blob, durationMs, { logger: false });
      } catch {
        // 보정 실패해도 재생은 가능
      }
    } else {
      try {
        const fixed = fixMp4Duration(await blob.arrayBuffer(), durationMs);
        if (fixed) blob = new Blob([fixed], { type: baseType });
      } catch {
        // 보정 실패해도 재생은 가능
      }
    }
    return { blob, durationSec: Math.round(durationMs / 1000), mimeType: baseType, ext, truncated: this.truncated };
  }

  /** 업로드 없이 폐기 */
  dispose() {
    try {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      // 무시
    }
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.chunks = [];
    this.recorder = null;
  }
}
