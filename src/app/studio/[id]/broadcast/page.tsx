import { BroadcastClient } from "@/components/broadcast/BroadcastClient";
import { ConfigMissing } from "@/components/ConfigMissing";
import { Forbidden, NotFoundCard } from "@/components/Forbidden";
import { requirePageUser } from "@/lib/server/auth";
import { fetchStream } from "@/lib/server/data";

export const metadata = { title: "송출 — LiveOn" };

export default async function BroadcastPage({ params }: PageProps<"/studio/[id]/broadcast">) {
  const { id } = await params;
  const { supabase, user } = await requirePageUser(`/studio/${id}/broadcast`);
  if (!supabase) return <ConfigMissing />;

  const { stream } = await fetchStream(supabase, id);
  if (!stream) return <NotFoundCard />;
  // 직접 URL 로 접근해도 소유자가 아니면 송출 화면 자체를 보여주지 않는다 (토큰 API 도 403)
  if (stream.owner_id !== user.id) return <Forbidden streamId={id} />;

  const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle();
  return (
    <BroadcastClient
      stream={{ id: stream.id, title: stream.title, owner_id: stream.owner_id }}
      viewer={{ id: user.id, nickname: (profile?.nickname as string | undefined) ?? "스트리머" }}
    />
  );
}
