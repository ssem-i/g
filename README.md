# LiveOn — 실시간 방송 플랫폼

> 서비스 주소: (배포 후 기입 예정)

PC 화면 공유와 모바일 카메라로 송출하고, 로그인 없이 어디서든 시청하는 실시간 방송 웹 서비스입니다.
Next.js(App Router) + LiveKit Cloud(WebRTC) + Supabase(Auth/Postgres/Realtime/Storage).

## 요구사항 충족 표

| 요구사항 | 구현 내용 | 코드 경로 | 확인 방법 |
|---|---|---|---|
| 데이터 모델 / RLS | 5개 테이블, 전 테이블 RLS, donate() 함수, Storage 버킷, 테스트 계정 시드 | `supabase/schema.sql` | SQL Editor에서 실행 |
| 환경 변수 | 이름만 있는 `.env.example`, 키 없이 빌드 통과 | `.env.example`, `src/lib/env.ts` | `npm run build` |
| 회원가입/로그인/로그아웃 | Supabase Auth 이메일+비밀번호, 가입 시 닉네임을 user metadata로 전달 → 트리거가 profiles 생성 | `src/components/AuthForm.tsx`, `src/components/LogoutButton.tsx`, `schema.sql`의 `handle_new_user` | `/signup`에서 가입 → 헤더에 닉네임 표시 |
| 테스트 계정 버튼 | 로그인 화면에 스트리머/시청자 버튼 2개 | `src/components/AuthForm.tsx`, `src/lib/test-accounts.ts` | `/login` → "스트리머로 로그인" |
| 방송 등록 | 제목/설명/카테고리, 로그인 필요, owner_id는 서버가 세션 사용자로 강제 | `src/app/api/streams/route.ts`, `src/components/StreamForm.tsx`, `src/app/studio/new/page.tsx` | 스튜디오 → "+ 새 방송" |
| 방송 목록/상세 | 메인에서 라이브 우선 정렬 + LIVE 배지, 상세 페이지 | `src/app/page.tsx`, `src/components/StreamCard.tsx`, `src/app/streams/[id]/page.tsx` | 메인 화면 |
| 방송 수정/삭제 (소유자만) | API에서 세션 검증 후 비소유자 403, DB RLS로 이중 차단, UI는 소유자에게만 버튼 표시, 수정 URL 직접 접근 시 "접근 권한이 없습니다" | `src/lib/server/api.ts`(`requireStreamOwner`), `src/app/api/streams/[id]/route.ts`, `src/app/studio/[id]/edit/page.tsx`, `schema.sql` RLS | 시청자 계정으로 `/studio/<스트리머 방송 id>/edit` 접속 → 차단 |
| 스튜디오 | 내 방송 목록, 송출/수정/삭제 | `src/app/studio/page.tsx` | 헤더 "스튜디오" |
| 송출 권한 (소유자만 canPublish) | 토큰 API가 Supabase 세션을 검증하고 방송 소유자에게만 `canPublish: true` 토큰 발급, 비소유자 403. 시청 토큰은 구독 전용 | `src/app/api/livekit/token/route.ts` | 시청자 계정으로 `/studio/<남의 방송>/broadcast` 접속 → 차단, API 직접 호출 → 403 |
| 방송 상태 live/offline | 송출 시작 시 live, 종료 시 offline. 탭 닫기 시 `sendBeacon`, 20초 하트비트가 75초 이상 끊기면 offline으로 간주, LiveKit 웹훅(선택)으로 즉시 offline | `src/app/api/streams/[id]/status/route.ts`, `src/lib/live.ts`, `src/app/api/livekit/webhook/route.ts` | 송출 중 탭 닫기 → 메인에서 LIVE 배지 사라짐 |
| PC 송출 | 화면 공유 + 탭/시스템 오디오 + 마이크, 각각 켜기/끄기와 상태 표시, 송출 전 미리보기, 탭 오디오 안내 문구 | `src/components/broadcast/Broadcaster.tsx` | 스튜디오 → 송출 시작 |
| 모바일 송출 | 기기 감지 후 카메라 모드, 전/후면 전환, 마이크 켜기/끄기, 화면 공유 미지원 시 버튼 숨김, `playsInline` | `src/components/broadcast/Broadcaster.tsx`, `src/lib/device.ts` | 휴대폰으로 송출 페이지 접속 |

(작업 진행에 따라 갱신됩니다)
