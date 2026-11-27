"use client";

import { LoaderCircle, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/glass/card";
import { useAdminAuth } from "./auth-provider";
import type { AccessStatus } from "./auth-state";
import { BilingualText } from "./bilingual";

const messages: Partial<Record<AccessStatus, { title: string; detail: string }>> = {
  verifying: {
    title: "Verifying access",
    detail: "Protected content stays hidden until verification finishes.",
  },
  forbidden: {
    title: "Admin access required",
    detail: "This account cannot open the admin workspace. Sign out to use another account.",
  },
  "session-expired": {
    title: "Sign-in required",
    detail: "Your session could not be verified. Sign out, then sign in again.",
  },
  "dependency-error": {
    title: "Verification is unavailable",
    detail: "Check the connection and retry. Your admin role has not been changed.",
  },
  "signing-out": {
    title: "Signing out",
    detail: "Clearing the local session.",
  },
  "signout-incomplete": {
    title: "Sign-out is incomplete",
    detail: "Protected content is hidden, but Firebase did not confirm sign-out. Retry to finish.",
  },
  "signing-in": {
    title: "Signing in",
    detail: "Your identity will be verified before access is shown.",
  },
  "signed-out": {
    title: "Sign in to continue",
    detail: "Sign in with an existing DontLift account to continue.",
  },
  authorized: {
    title: "Admin access verified",
    detail: "This session is already signed in. Continue to the identity workspace or sign out to switch accounts.",
  },
};

const translatedTitles: Record<string, string> = {
  verifying: "Đang xác minh quyền truy cập",
  forbidden: "Cần quyền quản trị",
  "session-expired": "Cần đăng nhập lại",
  "dependency-error": "Chưa thể xác minh",
  "signing-out": "Đang đăng xuất",
  "signout-incomplete": "Đăng xuất chưa hoàn tất",
  "signing-in": "Đang đăng nhập",
  "signed-out": "Đăng nhập để tiếp tục",
  authorized: "Quyền admin đã xác minh",
};

const translatedDetails: Record<string, string> = {
  verifying: "Nội dung quản trị được ẩn cho đến khi xác minh xong.",
  forbidden: "Tài khoản này chưa có quyền vào trang quản trị. Hãy đăng xuất để dùng tài khoản khác.",
  "session-expired": "Không thể xác minh phiên đăng nhập. Hãy đăng xuất rồi đăng nhập lại.",
  "dependency-error": "Kiểm tra kết nối rồi thử lại. Quyền admin của bạn chưa bị thay đổi.",
  "signing-out": "Đang xóa phiên đăng nhập trên tab này.",
  "signout-incomplete": "Nội dung quản trị đã được ẩn, nhưng Firebase chưa xác nhận đăng xuất. Hãy thử lại.",
  "signing-in": "Danh tính sẽ được xác minh trước khi hiển thị quyền truy cập.",
  "signed-out": "Đăng nhập bằng tài khoản DontLift hiện có để tiếp tục.",
  authorized: "Phiên này đã đăng nhập. Hãy mở không gian danh tính hoặc đăng xuất để đổi tài khoản.",
};

export function AccessStateView({ status }: { status: AccessStatus }) {
  const { controller } = useAdminAuth();
  const message = messages[status] ?? messages.verifying!;
  const busy = status === "verifying" || status === "signing-in" || status === "signing-out";
  const canRetry = status === "dependency-error" || status === "signout-incomplete";
  const canSignOut = status === "verifying" || status === "signing-in" || status === "authorized" || status === "forbidden" || status === "session-expired" || status === "dependency-error";

  return (
    <main className="auth-shell">
      <div className="auth-frame max-w-4xl! grid-cols-1!">
        <section className="auth-brand-panel min-h-0! flex-row! items-center! gap-4! rounded-2xl! px-6! py-5!">
          <div className="auth-brand-mark size-11! rounded-xl!" aria-hidden="true"><Dumbbell size={20} /></div>
          <div>
            <p className="text-sm font-semibold tracking-wide">DontLift Admin</p>
            <p className="text-xs text-[var(--auth-panel-muted)]"><BilingualText english="Access control" vietnamese="Kiểm soát truy cập" /></p>
          </div>
        </section>
        <Card material="regular" webgl={false} className="auth-card rounded-3xl! border-0! px-2! py-3!">
          <CardHeader className="px-7! pt-5!">
            <h1 className="text-xl font-semibold leading-snug">
              <BilingualText english={message.title} vietnamese={translatedTitles[status] ?? translatedTitles.verifying} stack />
            </h1>
          </CardHeader>
          <CardContent className="grid gap-6 px-7! pb-7!">
            <p role="status" aria-live="polite" className="text-sm leading-6 text-muted-foreground">
              <BilingualText english={message.detail} vietnamese={translatedDetails[status] ?? translatedDetails.verifying} stack />
            </p>
            {busy && (
              <div className="flex items-center gap-3 text-sm" aria-hidden="true">
                <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />
                <BilingualText english="Working" vietnamese="Đang xử lý" />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {canRetry && (
                <Button className="min-h-12 px-5" onClick={() => void controller.retry()}>
                  <BilingualText
                    english={status === "signout-incomplete" ? "Retry sign-out" : "Retry"}
                    vietnamese={status === "signout-incomplete" ? "Thử đăng xuất lại" : "Thử lại"}
                  />
                </Button>
              )}
              {canSignOut && (
                <Button variant={canRetry ? "outline" : "default"} className="min-h-12 px-5" onClick={() => void controller.signOut()}>
                  <BilingualText english="Sign out" vietnamese="Đăng xuất" />
                </Button>
              )}
              {status === "signed-out" && (
                <a className="rounded-lg px-4 py-3 font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4" href="/login">
                  <BilingualText english="Sign in" vietnamese="Đăng nhập" />
                </a>
              )}
              {status === "authorized" && (
                <a className="rounded-lg px-4 py-3 font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4" href="/dashboard">
                  <BilingualText english="Open identity workspace" vietnamese="Mở không gian danh tính" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
