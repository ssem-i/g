export type StreamStatus = "offline" | "live";

export interface Profile {
  id: string;
  nickname: string;
  points: number;
  created_at: string;
}

export interface Stream {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  status: StreamStatus;
  started_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface StreamWithOwner extends Stream {
  owner: Pick<Profile, "id" | "nickname"> | null;
}

export interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Donation {
  id: string;
  stream_id: string;
  from_user_id: string;
  amount: number;
  message: string;
  created_at: string;
}

export interface Recording {
  id: string;
  stream_id: string | null;
  owner_id: string;
  storage_path: string;
  duration: number;
  title: string;
  created_at: string;
}

export const CATEGORIES = [
  "게임",
  "토크",
  "음악",
  "스포츠",
  "교육",
  "개발",
  "먹방",
  "기타",
] as const;

/** streams 조회 시 소유자 닉네임을 함께 가져오는 select 문 */
export const STREAM_SELECT =
  "id, owner_id, title, description, category, status, started_at, last_seen_at, created_at, owner:profiles!streams_owner_id_fkey(id, nickname)";
