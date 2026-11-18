"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-bold">페이지를 표시하지 못했습니다</h1>
      <p className="mt-2 text-sm text-muted">
        일시적인 네트워크 오류일 수 있습니다. 아래 버튼으로 다시 시도하거나 잠시 후 새로고침하세요.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">오류 코드: {error.digest}</p>}
      <button type="button" onClick={reset} className="btn-primary mt-6">
        다시 시도
      </button>
    </div>
  );
}
