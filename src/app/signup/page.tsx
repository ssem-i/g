import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "회원가입 — onde" };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted">불러오는 중…</p>}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
