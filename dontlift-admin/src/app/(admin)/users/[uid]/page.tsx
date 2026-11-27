"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/glass/card";
import { BilingualText } from "@/features/auth/bilingual";
import { useAdminAuth } from "@/features/auth/auth-provider";
import { adminGet, formatTimestamp, formatVnd } from "@/features/dashboard/admin-api";
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from "@/features/dashboard/dashboard-ui";

interface UserDetail { uid: string; displayName?: string | null; email?: string | null; createdAt?: number | null; premiumExpiresAt?: number | null; disabled?: boolean | null; profileExists?: boolean; authExists?: boolean; }
interface Order { orderCode: string; packageId: string | null; amountVnd: number | null; status: string | null; createdAt: number | null; paidAt: number | null; }
interface DetailData { user: UserDetail; orders: Order[]; }

export default function UserDetailsPage({ params }: PageProps<"/users/[uid]">) {
  const { uid } = use(params);
  const { controller } = useAdminAuth();
  const [data, setData] = useState<DetailData | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const abort = new AbortController(); let active = true;
    void adminGet<DetailData>(`/api/admin/users/${encodeURIComponent(uid)}`, controller, abort.signal)
      .then((result) => { if (active) { setData(result); setFailed(false); } })
      .catch((error: unknown) => { if (active && !(error instanceof DOMException && error.name === "AbortError")) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; abort.abort(); };
  }, [controller, refreshKey, uid]);

  return <div className="admin-page">
    <PageHeading eyebrow="USER / ACCOUNT RECORD" title="User details / Chi tiết người dùng"
      description="Read-only account, entitlement and order information. / Thông tin tài khoản, Premium và đơn hàng chỉ đọc."
      action={<Link href="/users" className="admin-back-link"><ArrowLeft size={16} aria-hidden="true" /><BilingualText english="Back to users" vietnamese="Quay lại danh sách" /></Link>} />
    {failed ? <ErrorPanel onRetry={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} /> : busy && !data ? <LoadingPanel /> : data ? <>
      <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!">
        <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="FIREBASE ACCOUNT" vietnamese="TÀI KHOẢN FIREBASE" /></p>
          <h2>{data.user.displayName ?? "—"}</h2></div><span className={`admin-status ${data.user.disabled ? "status-cancelled" : "status-paid"}`}>{data.user.disabled ? "Disabled / Đã khóa" : data.user.authExists ? "Enabled / Đang hoạt động" : "Auth missing / Thiếu Auth"}</span></div>
        <dl className="admin-detail-grid">
          <div className="admin-detail-item"><dt>Email / Địa chỉ email</dt><dd>{data.user.email ?? "—"}</dd></div>
          <div className="admin-detail-item"><dt>Firebase UID</dt><dd className="font-mono">{data.user.uid}</dd></div>
          <div className="admin-detail-item"><dt><BilingualText english="Created" vietnamese="Ngày tạo" /></dt><dd>{formatTimestamp(data.user.createdAt ?? null)}</dd></div>
          <div className="admin-detail-item"><dt><BilingualText english="Premium expiration" vietnamese="Hạn Premium" /></dt><dd>{formatTimestamp(data.user.premiumExpiresAt ?? null)}</dd></div>
          <div className="admin-detail-item"><dt><BilingualText english="Firestore profile" vietnamese="Hồ sơ Firestore" /></dt><dd>{data.user.profileExists ? "Present / Có" : "Missing / Không có"}</dd></div>
          <div className="admin-detail-item"><dt><BilingualText english="Firebase Auth" vietnamese="Firebase Auth" /></dt><dd>{data.user.authExists ? "Present / Có" : "Missing / Không có"}</dd></div>
        </dl>
      </CardContent></Card>
      <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!">
        <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="ORDER HISTORY" vietnamese="LỊCH SỬ ĐƠN HÀNG" /></p><h2><BilingualText english="Most recent 25 orders" vietnamese="25 đơn gần nhất" /></h2></div></div>
        {data.orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><BilingualText english="Order" vietnamese="Mã đơn" /></th><th><BilingualText english="Package" vietnamese="Gói" /></th><th><BilingualText english="Amount" vietnamese="Số tiền" /></th><th><BilingualText english="Status" vietnamese="Trạng thái" /></th><th><BilingualText english="Created" vietnamese="Ngày tạo" /></th><th><BilingualText english="Paid" vietnamese="Đã thanh toán" /></th></tr></thead>
          <tbody>{data.orders.map((order) => <tr key={order.orderCode}><td className="font-mono">{order.orderCode}</td><td>{order.packageId ?? "—"}</td><td>{formatVnd(order.amountVnd)}</td><td><span className={`admin-status status-${order.status?.toLowerCase() ?? "unknown"}`}>{order.status ?? "—"}</span></td><td>{formatTimestamp(order.createdAt)}</td><td>{formatTimestamp(order.paidAt)}</td></tr>)}</tbody></table></div>
          : <EmptyPanel english="No orders found for this account" vietnamese="Tài khoản chưa có đơn hàng" />}
      </CardContent></Card>
    </> : null}
  </div>;
}
