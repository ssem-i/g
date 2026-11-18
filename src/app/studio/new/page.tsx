import { ConfigMissing } from "@/components/ConfigMissing";
import { StreamForm } from "@/components/StreamForm";
import { requirePageUser } from "@/lib/server/auth";

export const metadata = { title: "방송 만들기 — LiveOn" };

export default async function NewStreamPage() {
  const { supabase } = await requirePageUser("/studio/new");
  if (!supabase) return <ConfigMissing />;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">방송 만들기</h1>
      <StreamForm mode="create" />
    </div>
  );
}
