"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, LayoutDashboard, LogOut, ReceiptText, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BilingualText } from "@/features/auth/bilingual";
import { useAdminAuth } from "@/features/auth/auth-provider";

const sections = [
  { href: "/dashboard", icon: LayoutDashboard, english: "Overview", vietnamese: "Tổng quan" },
  { href: "/users", icon: Users, english: "Users", vietnamese: "Người dùng" },
  { href: "/orders", icon: ReceiptText, english: "Orders", vietnamese: "Đơn hàng" },
  { href: "/revenue", icon: Wallet, english: "Revenue", vietnamese: "Doanh thu" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, controller } = useAdminAuth();
  const identity = state.identity;
  return (
    <div className="admin-shell min-h-dvh">
      <div className="admin-backdrop" data-glass-backdrop aria-hidden="true" />
      <aside className="admin-sidebar">
        <Link href="/dashboard" className="admin-brand" aria-label="DontLift Admin overview">
          <span className="admin-brand-mark"><Dumbbell size={19} aria-hidden="true" /></span>
          <span><strong>DontLift Admin</strong><small><BilingualText english="Operations" vietnamese="Quản trị" /></small></span>
        </Link>
        <nav className="admin-nav" aria-label="Admin navigation">
          {sections.map(({ href, icon: Icon, english, vietnamese }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className={`admin-nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={18} aria-hidden="true" />
                <BilingualText english={english} vietnamese={vietnamese} />
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <p>{identity?.displayName || identity?.email || "Admin"}</p>
          <Button variant="outline" className="admin-signout" onClick={() => void controller.signOut()}>
            <LogOut size={16} aria-hidden="true" /><BilingualText english="Sign out" vietnamese="Đăng xuất" />
          </Button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
