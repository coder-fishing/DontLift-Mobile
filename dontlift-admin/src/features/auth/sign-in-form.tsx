"use client";

import { useState, type FormEvent } from "react";
import { Dumbbell, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/glass/card";
import { useAdminAuth } from "./auth-provider";
import { AccessStateView } from "./access-state-view";
import { BilingualText } from "./bilingual";

export function SignInForm() {
  const { state, controller } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const invalidCredentials = state.status === "invalid-credentials";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await controller.signIn(email, password);
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === "verifying" || state.status === "signing-in" || state.status === "signing-out" || state.status === "authorized" || state.status === "forbidden" || state.status === "session-expired" || state.status === "dependency-error" || state.status === "signout-incomplete") {
    return <AccessStateView status={state.status} />;
  }

  return (
    <main className="auth-shell">
      <div className="auth-frame">
        <section className="auth-brand-panel" aria-labelledby="brand-title">
          <div>
            <div className="flex items-center gap-3">
              <div className="auth-brand-mark" aria-hidden="true"><Dumbbell size={21} strokeWidth={1.8} /></div>
              <div>
                <p className="text-sm font-semibold tracking-wide">DONTLIFT</p>
            <p className="text-xs text-[var(--auth-panel-muted)]"><BilingualText english="Admin workspace" vietnamese="Không gian quản trị" /></p>
              </div>
            </div>
            <div className="mt-16 max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--auth-panel-muted)]">
                <BilingualText english="Private access" vietnamese="Truy cập riêng tư" />
              </p>
              <h1 id="brand-title" className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
                Training, in focus.
                <span className="mt-2 block text-2xl font-normal text-[var(--auth-panel-muted)]" lang="vi">Tập trung vào luyện tập.</span>
              </h1>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[var(--auth-panel-muted)]">
            <BilingualText english="Sign in with an existing DontLift account." vietnamese="Đăng nhập bằng tài khoản DontLift hiện có." stack />
          </p>
        </section>

        <Card material="regular" webgl={false} className="auth-card rounded-3xl! border-0! px-2! py-3!">
          <CardHeader className="px-7! pt-5!">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <BilingualText english="Admin sign-in" vietnamese="Đăng nhập admin" />
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              <BilingualText english="Welcome back" vietnamese="Chào mừng bạn trở lại" stack />
            </h2>
          </CardHeader>
          <CardContent className="px-7! pb-7!">
            <form className="grid gap-5" onSubmit={submit} noValidate>
              {invalidCredentials && (
                <div className="auth-error px-4 py-3 text-sm leading-5" role="alert">
                  <BilingualText english="Email or password is incorrect. Try again." vietnamese="Email hoặc mật khẩu chưa đúng. Hãy thử lại." stack />
                </div>
              )}
              <div className="grid gap-2">
                <label htmlFor="admin-email" className="text-sm font-medium">
                  <BilingualText english="Email address" vietnamese="Địa chỉ email" />
                </label>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  spellCheck={false}
                  required
                  className="auth-input"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="admin-password" className="text-sm font-medium">
                  <BilingualText english="Password" vietnamese="Mật khẩu" />
                </label>
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="auth-input"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
              </div>
              <Button className="mt-1 min-h-12 w-full rounded-xl! text-base" type="submit" disabled={submitting || !email || !password}>
                {submitting ? (
                  <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> <BilingualText english="Signing in" vietnamese="Đang đăng nhập" /></>
                ) : <BilingualText english="Sign in" vietnamese="Đăng nhập" />}
              </Button>
              <p className="text-center text-xs leading-5 text-muted-foreground">
                <BilingualText english="Access is verified by the server." vietnamese="Quyền truy cập được máy chủ xác minh." stack />
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
