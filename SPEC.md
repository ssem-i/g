# SPEC: 실시간 방송 플랫폼 (공모전 제출용)

치지직처럼 PC와 모바일에서 실시간 라이브 방송을 송출하고
시청하는 웹 서비스. 마감: 11월 19일(목) 23:59.
채점자는 배포된 서비스와 공개 GitHub 저장소의 코드를 본다.

## 0. 공식 요구사항 및 평가 기준 (원문)

이 섹션의 내용이 아래 1~8번과 다르면 이 섹션이 우선한다.

(나중에 원문을 붙여 넣을 자리)

## 1. 기술 스택

- Next.js (App Router, TypeScript), Tailwind CSS
- LiveKit Cloud: 실시간 영상/음성 송출과 시청 (WebRTC)
- Supabase: Auth, Postgres, Realtime, Storage
- Vercel 배포 (main 브랜치 푸시 시 자동 배포)

라이브러리 사용법은 기억에 의존하지 말고 설치된 버전의
공식 문서와 타입 정의를 확인한다.

## 2. 환경 변수

- NEXT_PUBLIC_LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

규칙:
- LIVEKIT_API_SECRET과 SUPABASE_SERVICE_ROLE_KEY는 서버
  코드에서만 쓴다.
- 값 없이 이름만 적은 .env.example을 저장소에 둔다.
- 환경 변수가 없어도 npm run build는 통과해야 한다.
- 키, 시크릿 값은 어떤 파일에도 커밋하지 않는다.

## 3. 필수 기능

### 3.1 사용자 인증 및 인가
- 이메일과 비밀번호로 회원가입, 로그인, 로그아웃 (Supabase Auth)
- 회원가입 시 닉네임을 받아 profiles에 저장
- 로그인 화면에 "테스트 계정으로 로그인" 버튼 2개:
  스트리머용, 시청자용
- 방송 수정, 삭제, 송출은 방송 소유자만 가능
  - DB: RLS 정책으로 소유자만 update/delete
  - 송출: 서버 API가 세션을 검증해 소유자에게만 canPublish
    토큰 발급
  - UI: 소유자가 아니면 수정/삭제/송출 버튼을 숨기고,
    직접 URL로 접근해도 차단
- 완료 기준: 시청자 계정으로 남의 방송을 수정, 삭제, 송출하려
  하면 UI와 API 양쪽에서 거부된다.

### 3.2 방송 관리 (CRUD)
- 등록: 제목, 설명, 카테고리 (로그인 필요)
- 조회: 메인에 방송 목록(라이브 중인 방송 우선, LIVE 배지),
  방송 상세 페이지
- 수정, 삭제: 소유자만
- 상태: offline / live. 송출 시작 시 live, 종료 시 offline.
  비정상 종료(탭 닫기)에도 offline으로 돌아가도록 처리한다.
- 내 방송 관리 페이지(스튜디오)

### 3.3 PC 라이브 방송
- 화면 공유, 소리 공유(시스템/탭 오디오), 마이크 송출
- 각각 켜고 끌 수 있는 버튼과 현재 상태 표시
- 송출 전 미리보기
- 소리 공유 안내 문구 표시: "Chrome에서 탭 공유 시
  '탭 오디오 공유'를 체크하세요"
- 완료 기준: PC Chrome에서 화면, 탭 소리, 마이크가 시청자에게
  동시에 전달된다.

### 3.4 모바일 라이브 방송
- 같은 웹에서 모바일 기기를 감지해 카메라와 마이크 송출 UI 제공
- 전면/후면 카메라 전환, 마이크 켜기/끄기
- 화면 공유 미지원 기기에서는 화면 공유 버튼을 숨긴다
- 완료 기준: iOS Safari와 Android Chrome에서 카메라와 마이크가
  송출된다. (video 태그에 playsInline, 사용자 터치 후 재생 시작)

### 3.5 실시간 시청
- 로그인 없이 시청 가능 (채점 편의)
- PC와 모바일 반응형 플레이어, 전체 화면, 음소거 해제 버튼
- 자동 재생이 막히면 "눌러서 시청 시작" 오버레이
- 현재 시청자 수 표시
- 방송이 꺼져 있으면 "방송 준비 중" 화면

## 4. 선택 기능 (가산점)

필수 기능이 모두 끝난 뒤에 시작한다.

### 4.1 댓글 (실시간 채팅)
- 로그인 사용자만 작성, 누구나 열람
- Supabase Realtime으로 실시간 반영, DB 저장
- 방송 소유자는 채팅 삭제 가능, 스트리머 배지 표시

### 4.2 도네이션
- 실결제 없이 가상 포인트. 가입 시 10,000 포인트 지급
- 금액과 메시지를 입력해 후원. 포인트 차감은 DB 함수로
  원자적으로 처리
- 후원 시 모든 시청자의 플레이어 위에 알림 오버레이 표시,
  채팅에도 강조 표시
- 스튜디오에서 받은 후원 내역 조회

### 4.3 녹화 및 다시보기
- 스트리머 브라우저에서 MediaRecorder로 송출 스트림을 녹화
- 방송 종료 시 Supabase Storage에 업로드하고 recordings에 기록
- 방송 상세와 채널 페이지에 다시보기 목록, 재생 페이지
- 소유자는 다시보기 삭제 가능

## 5. 데이터 모델

- profiles (id, nickname, points, created_at)
- streams (id, owner_id, title, description, category, status,
  started_at, created_at)
- chat_messages (id, stream_id, user_id, content, created_at)
- donations (id, stream_id, from_user_id, amount, message,
  created_at)
- recordings (id, stream_id, owner_id, storage_path, duration,
  created_at)

모든 테이블에 RLS를 켠다. 스키마, RLS, 함수, Storage 버킷,
테스트 계정 시드를 supabase/schema.sql 한 파일로 만든다.

## 6. 품질 기준

- 모든 페이지 모바일 반응형
- 로딩, 빈 상태, 오류 상태 처리 (권한 거부, 카메라 없음,
  네트워크 오류 포함)
- 오류 메시지는 한국어로, 해결 방법을 함께 안내
- npm run build와 타입 검사 통과

## 7. README 필수 항목

1. 서비스 주소 (맨 위)
2. 테스트 계정 2개와 "테스트 계정으로 로그인" 버튼 안내
3. 기능 확인 방법: 채점자가 따라 할 수 있는 단계별 시나리오
   (PC 송출 → 다른 기기에서 시청 → 모바일 송출 → 채팅 → 후원
   → 다시보기)
4. 요구사항 충족 표: 요구사항 / 구현 내용 / 코드 경로 / 확인 방법
5. 권장 환경과 알려진 제약 (소리 공유의 브라우저별 차이 등)
6. 로컬 실행 방법과 .env.example 설명
7. 아키텍처 요약

## 8. 구현 순서

1. 프로젝트 세팅, DB 스키마
2. 인증
3. 방송 CRUD와 소유자 권한
4. 토큰 발급 API, PC 송출
5. 모바일 송출
6. 시청 페이지
7. README 초안 (여기까지가 필수 기능)
8. 댓글
9. 도네이션
10. 녹화와 다시보기
11. 요구사항 전체 재검증, README 완성
