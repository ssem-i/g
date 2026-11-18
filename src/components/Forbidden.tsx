import Link from "next/link";

/** 비소유자가 수정/송출 URL 로 직접 접근했을 때 보여주는 화면 */
export function Forbidden({ streamId }: { streamId?: string }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-4xl" aria-hidden>
        🔒
      </p>
      <h1 className="mt-3 text-xl font-bold">접근 권한이 없습니다</h1>
      <p className="mt-2 text-sm text-muted">
        이 페이지는 방송 소유자만 사용할 수 있습니다. 본인 방송이라면 소유자 계정으로 다시 로그인하세요.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {streamId && (
          <Link href={`/streams/${streamId}`} className="btn-secondary">
            방송 보러 가기
          </Link>
        )}
        <Link href="/studio" className="btn-primary">
          내 스튜디오로
        </Link>
      </div>
    </div>
  );
}

export function NotFoundCard({ message = "방송을 찾을 수 없습니다." }: { message?: string }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-bold">{message}</h1>
      <p className="mt-2 text-sm text-muted">삭제되었거나 주소가 잘못되었을 수 있습니다. 메인에서 다른 방송을 찾아보세요.</p>
      <Link href="/" className="btn-primary mt-6">
        메인으로
      </Link>
    </div>
  );
}
