"use client";

/**
 * 백그라운드 탭에서도 느려지지 않는 타이머.
 * 브라우저는 숨겨진 탭의 setInterval 을 1분 단위까지 늦추지만,
 * Web Worker 안의 타이머는 제한이 훨씬 약하다. (화면 공유 중 다른 탭을 보고 있어도 하트비트 유지)
 */
export function workerInterval(callback: () => void, ms: number): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const src = `let id=null;onmessage=(e)=>{if(e.data&&e.data.start){clearInterval(id);id=setInterval(()=>postMessage(0),e.data.start)}else{clearInterval(id)}}`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const worker = new Worker(url);
    worker.onmessage = () => callback();
    worker.postMessage({ start: ms });
    return () => {
      worker.postMessage({ stop: true });
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = window.setInterval(callback, ms);
    return () => window.clearInterval(id);
  }
}
