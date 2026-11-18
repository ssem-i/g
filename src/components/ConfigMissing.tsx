import { Notice } from "@/components/Notice";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/env";

export function ConfigMissing() {
  return (
    <Notice tone="warn" title="서비스 설정이 필요합니다">
      {SUPABASE_NOT_CONFIGURED_MESSAGE}
    </Notice>
  );
}
