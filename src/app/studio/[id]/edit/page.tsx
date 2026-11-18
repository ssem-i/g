import { ConfigMissing } from "@/components/ConfigMissing";
import { DeleteStreamButton } from "@/components/DeleteStreamButton";
import { Forbidden, NotFoundCard } from "@/components/Forbidden";
import { StreamForm } from "@/components/StreamForm";
import { requirePageUser } from "@/lib/server/auth";
import { fetchStream } from "@/lib/server/data";

export const metadata = { title: "방송 수정 — LiveOn" };

export default async function EditStreamPage({ params }: PageProps<"/studio/[id]/edit">) {
  const { id } = await params;
  const { supabase, user } = await requirePageUser(`/studio/${id}/edit`);
  if (!supabase) return <ConfigMissing />;

  const { stream } = await fetchStream(supabase, id);
  if (!stream) return <NotFoundCard />;
  // 직접 URL 로 접근해도 소유자가 아니면 차단
  if (stream.owner_id !== user.id) return <Forbidden streamId={id} />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">방송 수정</h1>
        <DeleteStreamButton streamId={id} />
      </div>
      <StreamForm
        mode="edit"
        streamId={id}
        initial={{ title: stream.title, description: stream.description, category: stream.category }}
      />
    </div>
  );
}
