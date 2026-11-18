/**
 * 채점용 공개 테스트 계정. supabase/schema.sql 의 시드와 같다.
 * 비밀 정보가 아니라 README 에도 공개되는 데모 계정이다.
 */
export const TEST_ACCOUNTS = {
  streamer: { label: "스트리머", email: "streamer@test.com", password: "test1234!" },
  viewer: { label: "시청자", email: "viewer@test.com", password: "test1234!" },
} as const;
