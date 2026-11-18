"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Notice } from "@/components/Notice";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/env";
import { authErrorMessage } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { TEST_ACCOUNTS } from "@/lib/test-accounts";

function safeNext(next: string | null): string {
  // 오픈 리다이렉트 방지: 내부 경로만 허용
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signIn(em: string, pw: string, key: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError(SUPABASE_NOT_CONFIGURED_MESSAGE);
      return;
    }
    setPending(key);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) {
        setError(
          key === "form"
            ? authErrorMessage(error.message)
            : `테스트 계정 로그인에 실패했습니다. 관리자가 supabase/schema.sql 을 실행했는지 확인하세요. (${authErrorMessage(error.message)})`,
        );
        return;
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(authErrorMessage(e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === "login") {
      await signIn(email.trim(), password, "form");
      return;
    }
    const nick = nickname.trim();
    if (nick.length < 1 || nick.length > 20) {
      setError("닉네임은 1~20자로 입력하세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호가 너무 짧습니다. 6자 이상으로 입력하세요.");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError(SUPABASE_NOT_CONFIGURED_MESSAGE);
      return;
    }
    setPending("form");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { nickname: nick },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        setError(authErrorMessage(error.message));
        return;
      }
      if (data.session) {
        router.push(next);
        router.refresh();
      } else {
        setInfo(
          "가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요. 메일이 오지 않으면 스팸함을 확인하세요.",
        );
      }
    } catch (e) {
      setError(authErrorMessage(e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{mode === "login" ? "로그인" : "회원가입"}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login"
            ? "이메일과 비밀번호로 로그인하세요."
            : "가입하면 후원에 쓸 수 있는 10,000 포인트를 드립니다."}
        </p>

        {mode === "login" && (
          <section className="mt-6 rounded-lg border border-accent/40 bg-accent/5 p-4">
            <p className="text-sm font-semibold text-accent">테스트 계정으로 로그인</p>
            <p className="mt-1 text-xs text-muted">채점용 계정입니다. 버튼 하나로 바로 로그인됩니다.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(TEST_ACCOUNTS) as Array<keyof typeof TEST_ACCOUNTS>).map((key) => {
                const acc = TEST_ACCOUNTS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() => signIn(acc.email, acc.password, key)}
                    className={key === "streamer" ? "btn-primary" : "btn-secondary"}
                  >
                    {pending === key ? "로그인 중…" : `${acc.label}로 로그인`}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-sm">닉네임</span>
              <input
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                required
                placeholder="방송과 채팅에 표시될 이름"
                autoComplete="nickname"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm">이메일</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@example.com"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">비밀번호</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="6자 이상"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="success">{info}</Notice>}
          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
            {pending === "form" ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              계정이 없나요?{" "}
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent hover:underline">
                회원가입
              </Link>
            </>
          ) : (
            <>
              이미 계정이 있나요?{" "}
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent hover:underline">
                로그인
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
