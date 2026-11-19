# 사용자가 직접 해야 하는 작업 (순서대로)

키/시크릿 값은 저장소 파일에 쓰지 말고, 아래 대시보드와 Vercel 환경 변수에만 입력하세요.

## 0. GitHub 연결 (이 세션에서 푸시가 막혀 있음)
- [ ] https://claude.ai/connect-github 에서 GitHub 계정 연결, `ssem-i/g` 저장소에 Claude GitHub App 설치
- [ ] 연결 후 Claude에게 "푸시해" 라고 요청 (로컬 커밋이 쌓여 있음)

## 1. Supabase 프로젝트
1. [ ] https://supabase.com 에서 새 프로젝트 생성 (Region: Northeast Asia (Seoul) 권장)
2. [ ] **SQL Editor** → New query → `supabase/schema.sql` 전체를 붙여 넣고 **Run**
   - 여러 번 실행해도 됩니다. 테스트 계정 2개와 샘플 방송 1개가 함께 만들어집니다.
3. [ ] **Authentication → Sign In / Providers → Email**: `Confirm email`을 **끄기**
   - 채점자가 회원가입 직후 바로 로그인할 수 있게 하기 위함입니다.
4. [ ] **Authentication → URL Configuration**: Site URL을 Vercel 배포 주소로 설정
   (예: `https://xxx.vercel.app`), Redirect URLs에도 같은 주소 추가
5. [ ] **Project Settings → API**에서 아래 값 확인 (Vercel에 입력할 값)
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key 또는 Publishable key(`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (Vercel에 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 이름으로 넣어도 인식합니다)
   - service_role key 또는 Secret key(`sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY` (절대 공개 금지)
   - DB 비밀번호는 앱에서 쓰지 않습니다. 어디에도 넣지 마세요.
6. [ ] (확인) **Database → Publications → supabase_realtime**에 `streams`, `chat_messages`, `donations`가 켜져 있는지 확인
   (schema.sql이 자동으로 추가합니다)
7. [ ] (확인) **Storage**에 `recordings` 버킷(Public)이 생겼는지 확인
   - 무료 플랜은 파일당 업로드 한도가 50MB입니다. 다시보기는 약 10분 분량까지 업로드됩니다.
     더 긴 녹화가 필요하면 Storage → Settings에서 Upload file size limit을 늘리세요(유료 플랜).

## 2. LiveKit Cloud
1. [ ] https://cloud.livekit.io 에서 프로젝트 생성
2. [ ] **Settings → Keys**에서 API Key 생성
   - WebSocket URL(`wss://xxx.livekit.cloud`) → `NEXT_PUBLIC_LIVEKIT_URL`
   - API Key → `LIVEKIT_API_KEY`
   - API Secret → `LIVEKIT_API_SECRET` (절대 공개 금지)
3. [ ] (권장) **Settings → Webhooks**에 `https://<배포주소>/api/livekit/webhook` 추가,
   서명 키로 위에서 만든 API Key 선택
   - 스트리머가 탭을 닫았을 때 방송을 즉시 offline으로 돌리는 보조 장치입니다.
     설정하지 않아도 하트비트 만료(약 75초)로 offline 처리됩니다.

## 3. Vercel 배포
1. [ ] https://vercel.com → Add New → Project → GitHub `ssem-i/g` Import
2. [ ] Environment Variables에 위 6개 값 입력 (Production, Preview 모두)
3. [ ] Deploy → 배포 주소 확인
4. [ ] Supabase Auth URL Configuration(1-4)에 배포 주소 반영
5. [ ] README.md 맨 위 `서비스 주소`를 실제 배포 주소로 교체 (또는 Claude에게 주소를 알려 주기)

## 4. 실기기 확인 (README의 "기능 확인 방법" 순서대로)
- [ ] PC Chrome: 스트리머 테스트 계정 → 스튜디오 → 송출 → 화면+탭 오디오+마이크
- [ ] 다른 기기(휴대폰)에서 로그인 없이 시청, 소리/전체 화면/시청자 수 확인
- [ ] iOS Safari, Android Chrome에서 카메라 송출, 전/후면 전환
- [ ] 채팅, 후원 알림, 방송 종료 후 다시보기 확인

## 5. SPEC 0번
- [ ] 공모전 공식 요구사항 원문을 `SPEC.md` 0번 섹션에 붙여 넣기 (다르면 Claude에게 재검증 요청)
