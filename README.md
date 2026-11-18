# LiveOn — 실시간 방송 플랫폼

> **서비스 주소: (배포 후 기입 예정 — `https://<프로젝트>.vercel.app`)**
>
> GitHub: https://github.com/ssem-i/g

PC에서는 화면·탭 소리·마이크를, 모바일에서는 카메라·마이크를 브라우저만으로 송출하고,
로그인 없이 어떤 기기에서든 실시간으로 시청하는 방송 웹 서비스입니다.

- Next.js 16 (App Router, TypeScript) + Tailwind CSS v4
- LiveKit Cloud (WebRTC SFU) — 송출/시청
- Supabase — Auth, Postgres(RLS), Realtime, Storage
- Vercel 배포

---

## 1. 테스트 계정

로그인 화면(`/login`)의 **"테스트 계정으로 로그인"** 영역에서 버튼 한 번으로 로그인됩니다.

| 용도 | 버튼 | 이메일 | 비밀번호 |
|---|---|---|---|
| 스트리머 | `스트리머로 로그인` | `streamer@test.com` | `test1234!` |
| 시청자 | `시청자로 로그인` | `viewer@test.com` | `test1234!` |

- 스트리머 계정에는 샘플 방송 "테스트 방송: 화면 공유 데모"가 미리 만들어져 있습니다.
- 두 계정 모두 후원용 10,000 포인트로 시작합니다.

## 2. 기능 확인 방법 (단계별 시나리오)

준비물: PC(Chrome 권장) 1대 + 휴대폰 1대 (또는 PC 브라우저 창 2개)

1. **PC 송출**
   1. PC Chrome에서 `/login` → **스트리머로 로그인**
   2. 상단 **스튜디오** → 샘플 방송의 **송출 시작** (또는 **+ 새 방송**으로 제목·설명·카테고리 입력 후 등록)
   3. **🖥 화면 공유** → Chrome 공유 창에서 **Chrome 탭**을 고르고 **'탭 오디오 공유'를 체크** → 미리보기에 화면이 보임
   4. **🎤 마이크** 켜기 → 각 버튼 오른쪽에 `● 켜짐/꺼짐` 상태 표시
   5. **방송 시작** → 상단에 `LIVE`, 경과 시간, 시청자 수 표시
2. **다른 기기에서 시청**
   1. 휴대폰(로그인 불필요)으로 서비스 주소 접속 → 메인 "라이브 중"에 `LIVE` 배지가 붙은 방송 선택
   2. 소리 자동 재생이 막히면 **"눌러서 시청 시작"** 을 누름 → 화면 + 탭 소리 + 마이크 소리 확인
   3. 플레이어의 **음소거/해제**, **전체 화면**, 좌상단 **👁 시청자 수** 확인
3. **모바일 송출**
   1. 휴대폰에서 **스트리머로 로그인** → 스튜디오 → **+ 새 방송** 등록 (자동으로 송출 화면 이동)
   2. "모바일 기기가 감지되어 카메라 송출 모드" 안내 확인 (화면 공유 버튼 없음)
   3. **📷 카메라** → 권한 허용 → **🔄 카메라 전환**으로 전면/후면 전환, **🎤 마이크** 켜기 → **방송 시작**
   4. PC에서 해당 방송 페이지로 시청 확인
4. **채팅** — 시청자 계정으로 로그인해 방송 페이지 오른쪽 채팅 입력 → 다른 창에 즉시 표시. 스트리머 계정 메시지에는 `스트리머` 배지, 스트리머는 채팅 삭제 가능
5. **후원** — 시청자 계정으로 방송 페이지의 **후원** 에 금액·메시지 입력 → 모든 시청자의 플레이어 위에 후원 알림, 채팅에 강조 표시. 스트리머는 스튜디오에서 후원 내역 확인
6. **다시보기** — 스트리머가 **방송 종료**를 누르면 녹화 파일이 업로드되고, 방송 상세/채널 페이지의 **다시보기** 목록에서 재생. 소유자는 삭제 가능
7. **권한 확인** — 시청자 계정으로 스트리머 방송의 `/studio/<방송ID>/edit`, `/studio/<방송ID>/broadcast`에 직접 접속 → "접근 권한이 없습니다". API(`PATCH /api/streams/<id>`, `POST /api/livekit/token` role=publisher)도 403
8. **비정상 종료** — 송출 중 탭을 닫으면 즉시(sendBeacon) 또는 최대 75초(하트비트 만료) 안에 `LIVE` 배지가 사라짐

## 3. 요구사항 충족 표

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
| 실시간 시청 | 로그인 없이 구독 전용 토큰으로 시청, 반응형 16:9 플레이어, 전체 화면(iPhone은 비디오 전체 화면), 음소거/해제와 볼륨, 자동 재생 차단 시 "눌러서 시청 시작" 오버레이, 현재 시청자 수, 꺼진 방송은 "방송 준비 중"(Realtime으로 상태 자동 반영) | `src/components/viewer/Viewer.tsx`, `src/app/streams/[id]/page.tsx` | 로그아웃 상태로 방송 상세 페이지 접속 |
| (선택) 실시간 채팅 | 로그인 사용자만 작성(RLS `user_id = auth.uid()`), 누구나 열람, Supabase Realtime INSERT/DELETE 구독, DB 저장, 방송 소유자는 모든 채팅 삭제(RLS), 스트리머 배지 | `src/components/chat/ChatPanel.tsx`, `schema.sql` chat_messages 정책 | 두 창에서 같은 방송 열고 채팅 |


## 4. 권장 환경과 알려진 제약

| 구분 | 권장 |
|---|---|
| PC 송출 | Windows/macOS **Chrome** 또는 **Edge** 최신 버전 |
| 모바일 송출 | iOS 15+ **Safari**, Android **Chrome** |
| 시청 | 최신 Chrome / Edge / Safari / Firefox / Samsung Internet |

- **소리 공유는 브라우저/OS마다 다릅니다.**
  - Chrome/Edge: **탭 공유 + '탭 오디오 공유' 체크**가 가장 확실합니다.
  - Windows Chrome/Edge: 전체 화면 공유 시 **'시스템 오디오도 공유'** 로 PC 소리 전체를 보낼 수 있습니다.
  - macOS Chrome: 창/전체 화면 공유는 소리를 보낼 수 없고 **탭 공유만** 소리가 됩니다.
  - Firefox, Safari(PC): 화면 공유 오디오를 지원하지 않아 화면만 송출됩니다(마이크는 가능).
- 모바일 브라우저는 화면 공유(getDisplayMedia)를 지원하지 않아 화면 공유 버튼을 숨기고 카메라 모드로 동작합니다.
- 모바일은 소리 자동 재생이 막혀 있어 시청 시 **"눌러서 시청 시작"** 을 한 번 눌러야 합니다.
- iPhone은 요소 전체 화면을 지원하지 않아 **비디오 전용 전체 화면**으로 열립니다.
- 송출 페이지를 백그라운드로 보내면(모바일 홈 화면 이동 등) OS가 카메라를 멈출 수 있습니다. 송출 중에는 화면을 켜 두세요.
- 회사/학교 네트워크가 WebRTC(UDP)를 막으면 연결이 실패할 수 있습니다(LiveKit Cloud의 TURN/TLS로 대부분 우회).
- 다시보기 녹화는 스트리머 브라우저에서 진행되므로, 탭을 강제로 닫으면 해당 방송의 녹화는 저장되지 않습니다. Supabase 무료 플랜은 파일당 50MB 제한이 있어 약 10분 분량까지 저장됩니다.

## 5. 로컬 실행 방법

```bash
git clone https://github.com/ssem-i/g.git && cd g
npm install
cp .env.example .env.local   # 값 입력 (아래 표)
npm run dev                  # http://localhost:3000
```

검증 명령: `npm run typecheck` (route 타입 생성 + tsc), `npm run build`

`.env.example` 설명 (값은 절대 커밋하지 마세요. `.env*.local`은 `.gitignore`에 포함)

| 변수 | 어디서 | 사용 위치 |
|---|---|---|
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit Cloud → Settings → Keys의 WebSocket URL (`wss://…livekit.cloud`) | 서버·클라이언트 |
| `LIVEKIT_API_KEY` | LiveKit Cloud API Key | 서버 전용 (토큰 발급, 웹훅 검증) |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API Secret | **서버 전용** (`src/lib/server-env.ts`, `server-only`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | 서버·클라이언트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key | 서버·클라이언트 (RLS 적용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | **서버 전용** (LiveKit 웹훅에서 offline 처리) |

DB는 Supabase SQL Editor에서 `supabase/schema.sql`을 한 번 실행하면 됩니다(재실행 안전). 전체 설정 순서는 [`TODO_USER.md`](./TODO_USER.md) 참고.
환경 변수가 없어도 `npm run build`는 통과하며, 화면에는 "서비스 설정이 필요합니다" 안내가 표시됩니다.

## 6. 아키텍처 요약

```
[스트리머 브라우저]                         [시청자 브라우저 (로그인 불필요)]
 getDisplayMedia / getUserMedia              video(playsInline) + audio
        │ publish (WebRTC)                           ▲ subscribe (WebRTC)
        ▼                                            │
   ┌──────────────── LiveKit Cloud (SFU) ───────────────┐
   └─────────────▲──────────────────────────▲───────────┘
                 │ JWT (canPublish=소유자만)   │ JWT (구독 전용)
        ┌────────┴──────────────────────────┴────────┐
        │ Next.js on Vercel                           │
        │  /api/livekit/token   세션 검증 → 토큰 발급   │
        │  /api/streams/*       CRUD, live/offline     │
        │  /api/livekit/webhook 호스트 퇴장 → offline   │
        │  proxy.ts             Supabase 세션 갱신      │
        └────────┬───────────────────────────────────┘
                 │ RLS(사용자 세션) / service_role(웹훅만)
        ┌────────▼───────────────────────────────────┐
        │ Supabase: Auth · Postgres(RLS) · Realtime   │
        │           · Storage(recordings)             │
        └────────────────────────────────────────────┘
```

- **권한은 3겹**: UI(소유자에게만 버튼, 직접 URL 접근 시 차단 화면) → API(세션 검증 후 403) → DB(RLS).
- **방 이름** `stream-<방송ID>`, 스트리머 identity `host-<userId>`, 시청자 `viewer-…`/`guest-…` → 시청자 수 = 방 참가자 중 host 제외.
- **live/offline**: 송출 시작/종료 API + 20초 하트비트(Web Worker 타이머로 백그라운드 탭에서도 유지) + 탭 닫기 `sendBeacon` + LiveKit 웹훅. 목록/플레이어는 `status='live'`이고 하트비트가 75초 이내일 때만 라이브로 표시.
- **실시간 데이터**: 채팅·후원·방송 상태는 Supabase Realtime(postgres_changes)으로 전달.
- **후원**: `donate()` DB 함수(security definer)가 잔액 확인·차감·적립·기록을 한 트랜잭션에서 처리. 클라이언트는 포인트를 직접 수정할 권한이 없음(컬럼 권한).

### 폴더 구조

```
supabase/schema.sql            DB 전체 (테이블, RLS, 함수, Realtime, Storage, 시드)
src/proxy.ts                   세션 갱신 (Next.js 16 Proxy)
src/app/                       페이지와 API 라우트
src/components/broadcast/      송출 (PC 화면 공유 / 모바일 카메라)
src/components/viewer/         시청 플레이어
src/lib/                       env, Supabase 클라이언트, 공통 유틸
```
