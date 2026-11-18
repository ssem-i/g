/** Supabase / 네트워크 / 미디어 오류를 해결 방법이 담긴 한국어 문장으로 바꾼다. */

export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다. 입력값을 확인하거나 회원가입을 먼저 진행하세요.";
  if (m.includes("email not confirmed"))
    return "이메일 인증이 완료되지 않았습니다. 받은편지함의 인증 메일 링크를 누른 뒤 다시 로그인하세요.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "이미 가입된 이메일입니다. 로그인 화면에서 로그인하세요.";
  if (m.includes("password") && (m.includes("at least") || m.includes("short")))
    return "비밀번호가 너무 짧습니다. 6자 이상으로 입력하세요.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "요청이 너무 많습니다. 1분 정도 기다린 뒤 다시 시도하세요.";
  if (m.includes("invalid") && m.includes("email"))
    return "이메일 형식이 올바르지 않습니다. 예: name@example.com";
  if (m.includes("fetch") || m.includes("network"))
    return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.";
  return `요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요. (${message ?? "알 수 없는 오류"})`;
}

export function dbErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("row-level security") || m.includes("permission denied"))
    return "권한이 없습니다. 본인 소유의 방송인지, 로그인 상태인지 확인하세요.";
  if (m.includes("jwt") || m.includes("not authenticated"))
    return "로그인이 만료되었습니다. 다시 로그인하세요.";
  if (m.includes("fetch") || m.includes("network"))
    return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.";
  // donate() 등 DB 함수가 직접 던진 한국어 메시지는 그대로 보여준다.
  if (/[가-힣]/.test(message ?? "")) return message as string;
  return `요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요. (${message ?? "알 수 없는 오류"})`;
}

/** getUserMedia / getDisplayMedia 오류 */
export function mediaErrorMessage(err: unknown, kind: "camera" | "mic" | "screen"): string {
  const name = err instanceof Error ? err.name : "";
  const label = kind === "camera" ? "카메라" : kind === "mic" ? "마이크" : "화면 공유";
  if (name === "NotAllowedError" || name === "SecurityError") {
    if (kind === "screen")
      return "화면 공유가 취소되었거나 권한이 거부되었습니다. 다시 버튼을 누르고 공유할 화면/탭을 선택하세요. (macOS는 시스템 설정 → 개인정보 보호 → 화면 기록에서 브라우저를 허용해야 합니다.)";
    return `${label} 권한이 거부되었습니다. 주소창 왼쪽의 자물쇠(사이트 설정) 아이콘을 눌러 ${label} 권한을 '허용'으로 바꾼 뒤 다시 시도하세요.`;
  }
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return `${label} 장치를 찾을 수 없습니다. 장치가 연결되어 있는지 확인하세요.`;
  if (name === "NotReadableError" || name === "AbortError")
    return `${label}을(를) 다른 앱이 사용 중입니다. 화상회의 앱 등을 종료한 뒤 다시 시도하세요.`;
  if (name === "NotSupportedError" || name === "TypeError")
    return `이 브라우저는 ${label}을(를) 지원하지 않습니다. PC는 Chrome/Edge, 모바일은 Safari(iOS) 또는 Chrome(Android)을 사용하세요. HTTPS 주소인지도 확인하세요.`;
  return `${label}을(를) 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도하세요. (${err instanceof Error ? err.message : String(err)})`;
}
