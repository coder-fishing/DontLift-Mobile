"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/glass/card";
import { BilingualText } from "@/features/auth/bilingual";
import { useAdminAuth } from "@/features/auth/auth-provider";
import { adminGet, formatTimestamp, formatVnd } from "@/features/dashboard/admin-api";
import { EmptyPanel, ErrorPanel, PageHeading, TableSkeleton } from "@/features/dashboard/dashboard-ui";

interface OrderRow {
  orderCode: string; uid: string | null; packageId: string | null; amountVnd: number | null; status: string | null;
  paidMonths: number | null; grantedMonths: number | null; createdAt: number | null; paidAt: number | null;
  grantedExpiresAt: number | null; receiptValid: boolean;
}
interface OrdersData { rows: OrderRow[]; nextCursor: string | null; exactMatch: boolean; }
interface OrderFilters { q: string; status: string; packageId: string; dateMode: string; from: string; to: string; }

export default function OrdersPage() {
  const { controller } = useAdminAuth();
  const [filters, setFilters] = useState<OrderFilters>({ q: "", status: "", packageId: "", dateMode: "created", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const [cursor, setCursor] = useState<string | null>(null);
  const [data, setData] = useState<OrdersData | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const abort = new AbortController(); let active = true;
    const params = new URLSearchParams({ limit: "10", dateMode: applied.dateMode });
    if (applied.q) params.set("q", applied.q);
    if (applied.status) params.set("status", applied.status);
    if (applied.packageId) params.set("packageId", applied.packageId);
    if (applied.from && applied.to) { params.set("from", applied.from); params.set("to", applied.to); }
    if (cursor) params.set("cursor", cursor);
    void adminGet<OrdersData>(`/api/admin/orders?${params}`, controller, abort.signal)
      .then((result) => { if (active) { setData(result); setFailed(false); } })
      .catch((error: unknown) => { if (active && !(error instanceof DOMException && error.name === "AbortError")) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; abort.abort(); };
  }, [applied, controller, cursor, refreshKey]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFailed(false); setCursor(null); setApplied({ ...filters, q: filters.q.trim() });
  }

  return <div className="admin-page">
    <PageHeading eyebrow="PREMIUM / PURCHASE RECORDS" title="Orders / Đơn hàng"
      description="Inspect payment and entitlement receipts. Payment state is read-only here. / Xem thông tin thanh toán và biên nhận Premium. Trạng thái thanh toán chỉ đọc." />
    <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5!">
      <form className="grid gap-4" onSubmit={applyFilters}>
        <div className="admin-search-row"><label className="grid gap-1.5 text-xs font-semibold text-slate-600"><span><BilingualText english="Order code or exact UID" vietnamese="Mã đơn hoặc UID chính xác" /></span>
          <input className="admin-search-input" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Order code / UID" aria-label="Order code or exact UID / Mã đơn hoặc UID chính xác" /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600"><span><BilingualText english="Status" vietnamese="Trạng thái" /></span>
            <select className="admin-filter-control" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} aria-label="Order status / Trạng thái đơn">
              <option value="">All / Tất cả</option><option value="CREATING">CREATING</option><option value="PENDING">PENDING</option><option value="PAID">PAID</option><option value="CANCELLED">CANCELLED</option><option value="EXPIRED">EXPIRED</option></select></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600"><span><BilingualText english="Package" vietnamese="Gói" /></span>
            <select className="admin-filter-control" value={filters.packageId} onChange={(event) => setFilters({ ...filters, packageId: event.target.value })} aria-label="Package / Gói">
              <option value="">All / Tất cả</option><option value="MONTH_1">1 month / 1 tháng</option><option value="MONTH_3">3 months / 3 tháng</option><option value="MONTH_6">6 months / 6 tháng</option><option value="MONTH_12">12 months / 12 tháng</option></select></label>
        </div>
        <div className="admin-filter-stack">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600"><span><BilingualText english="Date uses" vietnamese="Lọc theo ngày" /></span>
            <select className="admin-filter-control" value={filters.dateMode} onChange={(event) => setFilters({ ...filters, dateMode: event.target.value })} aria-label="Date field / Trường ngày">
              <option value="created">Creation date / Ngày tạo</option><option value="paid">Payment date / Ngày thanh toán</option></select></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600"><span><BilingualText english="From" vietnamese="Từ ngày" /></span><input className="admin-filter-control" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600"><span><BilingualText english="To" vietnamese="Đến ngày" /></span><input className="admin-filter-control" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <Button type="submit" className="min-h-11 self-end bg-[#087f69] text-white hover:bg-[#066957] hover:text-white"><BilingualText english="Apply filters" vietnamese="Áp dụng bộ lọc" /></Button>
          <Button type="button" variant="outline" className="min-h-11 self-end" onClick={() => { const cleared = { q: "", status: "", packageId: "", dateMode: "created", from: "", to: "" }; setBusy(true); setFailed(false); setFilters(cleared); setApplied(cleared); setCursor(null); }}><BilingualText english="Clear" vietnamese="Xóa lọc" /></Button>
        </div>
      </form>
    </CardContent></Card>
    <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!">
      <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="CANONICAL RECEIPTS" vietnamese="BIÊN NHẬN GỐC" /></p><h2><BilingualText english="Order records" vietnamese="Hồ sơ đơn hàng" /></h2></div>
        <Button variant="outline" className="min-h-10" onClick={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} disabled={busy}><BilingualText english="Refresh" vietnamese="Làm mới" /></Button></div>
      {failed ? <ErrorPanel onRetry={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} /> : busy && !data ? <TableSkeleton columns={8} /> : busy ? <TableSkeleton columns={8} /> : data?.rows.length ? <>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><BilingualText english="Order" vietnamese="Mã đơn" /></th><th>UID</th><th><BilingualText english="Package" vietnamese="Gói" /></th><th><BilingualText english="Amount" vietnamese="Số tiền" /></th><th><BilingualText english="Status" vietnamese="Trạng thái" /></th><th><BilingualText english="Created" vietnamese="Ngày tạo" /></th><th><BilingualText english="Paid" vietnamese="Ngày trả" /></th><th><BilingualText english="Premium until" vietnamese="Premium đến" /></th></tr></thead>
          <tbody>{data.rows.map((order) => <tr key={order.orderCode}><td className="font-mono">{order.orderCode}</td><td className="font-mono">{order.uid ?? "—"}</td><td>{order.packageId ?? "—"}</td><td>{formatVnd(order.amountVnd)}</td>
            <td><span className={`admin-status status-${order.status?.toLowerCase() ?? "unknown"}`}>{order.status ?? "—"}</span>{order.status === "PAID" && !order.receiptValid && <small className="ml-1 text-amber-800"><BilingualText english="Needs review" vietnamese="Cần rà soát" /></small>}</td>
            <td>{formatTimestamp(order.createdAt)}</td><td>{formatTimestamp(order.paidAt)}</td><td>{formatTimestamp(order.grantedExpiresAt)}</td></tr>)}</tbody></table></div>
        <div className="admin-pagination"><Button variant="outline" className="min-h-11" disabled={!cursor || busy} onClick={() => { setBusy(true); setCursor(null); }}><BilingualText english="First page" vietnamese="Trang đầu" /></Button>
          <Button className="min-h-11 bg-[#087f69] text-white hover:bg-[#066957] hover:text-white" disabled={!data.nextCursor || busy} onClick={() => { setBusy(true); setCursor(data.nextCursor); }}><BilingualText english="Next page" vietnamese="Trang sau" /></Button></div>
      </> : <EmptyPanel english="No orders match these filters" vietnamese="Không có đơn hàng khớp bộ lọc" />}
    </CardContent></Card>
    <p className="admin-page-footnote"><BilingualText english="Order statuses and amounts are read-only; amounts come from each historical order snapshot." vietnamese="Trạng thái và số tiền chỉ đọc; số tiền lấy từ snapshot lịch sử của từng đơn." stack /></p>
    {busy && data && <p className="sr-only" role="status">Loading updated data / Đang làm mới dữ liệu</p>}
  </div>;
}
