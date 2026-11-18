@AGENTS.md

# 작업 규칙 (이 저장소에서 작업하는 에이전트용)

- 기준 문서는 `SPEC.md`. SPEC 0번(공식 원문)이 채워지면 그것이 최우선.
- Next.js 16 (App Router). 코드 작성 전 `node_modules/next/dist/docs/`의 해당 문서를 확인한다.
  - Middleware는 `src/proxy.ts`(Proxy)로 이름이 바뀌었다. `params`, `cookies()`는 Promise.
  - `cacheComponents`는 꺼 두었다(사용자별 동적 페이지 위주).
- Tailwind v4: 커스텀 클래스는 `globals.css`의 `@utility`로 정의한다.
- DB 관련 내용은 전부 `supabase/schema.sql` 한 파일. 여러 번 실행해도 오류가 없어야 한다.
- 시크릿(`LIVEKIT_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`)은 `src/lib/server-env.ts`(server-only)에서만 읽는다.
- 환경 변수가 없어도 `npm run build`가 통과해야 한다. 키 값은 어떤 파일에도 쓰지 않는다.
- 단계 완료 시: `npm run typecheck && npm run build` → 이 체크리스트 갱신 → README 요구사항 표 갱신 → 커밋/푸시.
- 사용자가 직접 해야 하는 일은 `TODO_USER.md`에 적는다.

# SPEC 요구사항 체크리스트

표기: [x] 코드 구현 완료 · [ ] 미구현 · (실기기) = 배포본에서 사용자가 실기기 확인 필요

## 1. 기술 스택
- [x] Next.js App Router + TypeScript + Tailwind CSS
- [x] LiveKit (livekit-client / livekit-server-sdk)
- [x] Supabase Auth, Postgres, Realtime, Storage
- [ ] Vercel 배포 (사용자 작업 — TODO_USER.md)

## 2. 환경 변수
- [x] 6개 변수 이름 기준으로 코드 작성 (`src/lib/env.ts`, `src/lib/server-env.ts`)
- [x] 시크릿은 서버 코드에서만 사용 (`server-only`)
- [x] 값 없는 `.env.example`
- [x] 환경 변수 없이 `npm run build` 통과
- [x] `.gitignore`에 `.env*.local` 포함, 키 커밋 없음

## 3.1 인증/인가
- [x] 이메일+비밀번호 회원가입/로그인/로그아웃
- [x] 회원가입 시 닉네임 → profiles 저장
- [x] 로그인 화면 "테스트 계정으로 로그인" 버튼 2개 (스트리머/시청자)
- [x] DB: RLS로 소유자만 update/delete (schema.sql)
- [x] 송출: 서버 API가 세션 검증 후 소유자에게만 canPublish 토큰
- [x] UI: 비소유자에게 수정/삭제/송출 버튼 숨김
- [x] UI: 직접 URL 접근 차단 (수정/송출 페이지)
- [ ] 완료 기준: 시청자 계정으로 남의 방송 수정/삭제/송출 시 UI·API 양쪽 거부

## 3.2 방송 CRUD
- [x] 등록: 제목, 설명, 카테고리 (로그인 필요)
- [x] 메인 목록: 라이브 우선 정렬, LIVE 배지
- [x] 방송 상세 페이지
- [x] 수정/삭제: 소유자만
- [x] 상태 offline/live: 송출 시작 live, 종료 offline
- [x] 비정상 종료(탭 닫기) 시 offline 복귀
- [x] 스튜디오(내 방송 관리) 페이지

## 3.3 PC 라이브 방송
- [x] 화면 공유 / 소리 공유(탭·시스템 오디오) / 마이크 송출
- [x] 각각 켜기/끄기 버튼 + 현재 상태 표시
- [x] 송출 전 미리보기
- [x] 안내 문구 "Chrome에서 탭 공유 시 '탭 오디오 공유'를 체크하세요"
- [ ] (실기기) PC Chrome에서 화면+탭 소리+마이크 동시 전달 — Playwright 가짜 장치로 화면(1920x1080)+탭 오디오+마이크 트랙 생성/토글 UI까지 확인, LiveKit 실서버 송출은 미검증

## 3.4 모바일 라이브 방송
- [x] 모바일 기기 감지 → 카메라/마이크 송출 UI
- [x] 전면/후면 카메라 전환, 마이크 켜기/끄기
- [x] 화면 공유 미지원 기기에서 화면 공유 버튼 숨김
- [x] video 태그 playsInline, 사용자 터치(버튼) 후 카메라 시작 (송출 측). 시청 측 video도 playsInline, 소리는 터치 후 재생
- [ ] (실기기) iOS Safari / Android Chrome 송출

## 3.5 실시간 시청
- [x] 로그인 없이 시청
- [x] 반응형 플레이어, 전체 화면, 음소거 해제 버튼
- [x] 자동 재생 차단 시 "눌러서 시청 시작" 오버레이
- [x] 현재 시청자 수 표시
- [x] 방송 꺼짐 시 "방송 준비 중" 화면

## 4.1 댓글 (선택)
- [ ] 로그인 사용자만 작성, 누구나 열람
- [ ] Supabase Realtime 실시간 반영 + DB 저장
- [ ] 방송 소유자 채팅 삭제, 스트리머 배지

## 4.2 도네이션 (선택)
- [x] 가입 시 10,000 포인트 (schema.sql 트리거)
- [x] 포인트 차감 DB 함수 원자 처리 (`donate()`)
- [ ] 금액+메시지 입력 후원 UI
- [ ] 모든 시청자 플레이어 위 알림 오버레이 + 채팅 강조
- [ ] 스튜디오 후원 내역

## 4.3 녹화/다시보기 (선택)
- [ ] MediaRecorder로 송출 스트림 녹화
- [ ] 종료 시 Storage 업로드 + recordings 기록
- [ ] 방송 상세/채널 페이지 다시보기 목록, 재생 페이지
- [ ] 소유자 다시보기 삭제

## 5. 데이터 모델
- [x] profiles, streams, chat_messages, donations, recordings
- [x] 모든 테이블 RLS
- [x] schema.sql 한 파일 (스키마, RLS, 함수, 버킷, 테스트 계정 시드), 재실행 안전 (로컬 Postgres 16에서 2회 연속 실행 검증)

## 6. 품질
- [ ] 모든 페이지 모바일 반응형
- [ ] 로딩/빈/오류 상태 (권한 거부, 카메라 없음, 네트워크 오류)
- [ ] 한국어 오류 메시지 + 해결 방법
- [x] npm run build, 타입 검사 통과

## 7. README
- [ ] 서비스 주소 (맨 위)
- [ ] 테스트 계정 2개 + 버튼 안내
- [ ] 단계별 확인 시나리오
- [ ] 요구사항 충족 표
- [ ] 권장 환경과 알려진 제약
- [ ] 로컬 실행 방법, .env.example 설명
- [ ] 아키텍처 요약

## 8. 진행 단계
- [x] 1. 프로젝트 세팅, DB 스키마
- [x] 2. 인증
- [x] 3. 방송 CRUD와 소유자 권한
- [x] 4. 토큰 발급 API, PC 송출
- [x] 5. 모바일 송출
- [x] 6. 시청 페이지
- [ ] 7. README 초안
- [ ] 8. 댓글
- [ ] 9. 도네이션
- [ ] 10. 녹화와 다시보기
- [ ] 11. 전체 재검증, README 완성
