"use client";

/** 모바일 기기 여부 (iPadOS 데스크톱 모드 포함) */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile) return true;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return true;
  // iPadOS 13+ 는 데스크톱 Safari UA 를 쓴다.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** 화면 공유(getDisplayMedia) 지원 여부. 모바일 브라우저는 지원하지 않거나 불안정하므로 제외한다. */
export function canShareScreen(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices) && !isMobileDevice();
}

export function canUseCamera(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export interface DeviceInfo {
  mobile: boolean;
  screen: boolean;
  camera: boolean;
  ios: boolean;
}

let cached: DeviceInfo | null = null;
/** useSyncExternalStore 용 스냅샷 (클라이언트에서 한 번만 계산) */
export function getDeviceInfo(): DeviceInfo {
  if (!cached) {
    cached = { mobile: isMobileDevice(), screen: canShareScreen(), camera: canUseCamera(), ios: isIOS() };
  }
  return cached;
}
export const subscribeNoop = () => () => {};
export const getServerDeviceInfo = (): DeviceInfo | null => null;
