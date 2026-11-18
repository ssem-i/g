# LiveOn — 실시간 방송 플랫폼

> 서비스 주소: (배포 후 기입 예정)

PC 화면 공유와 모바일 카메라로 송출하고, 로그인 없이 어디서든 시청하는 실시간 방송 웹 서비스입니다.
Next.js(App Router) + LiveKit Cloud(WebRTC) + Supabase(Auth/Postgres/Realtime/Storage).

## 요구사항 충족 표

| 요구사항 | 구현 내용 | 코드 경로 | 확인 방법 |
|---|---|---|---|
| 데이터 모델 / RLS | 5개 테이블, 전 테이블 RLS, donate() 함수, Storage 버킷, 테스트 계정 시드 | `supabase/schema.sql` | SQL Editor에서 실행 |
| 환경 변수 | 이름만 있는 `.env.example`, 키 없이 빌드 통과 | `.env.example`, `src/lib/env.ts` | `npm run build` |

(작업 진행에 따라 갱신됩니다)
