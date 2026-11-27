"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/glass/card";
import { BilingualText } from "@/features/auth/bilingual";
import { useAdminAuth } from "@/features/auth/auth-provider";
import { adminGet, currentMonthDates, dateQuery, formatTimestamp, formatVnd } from "@/features/dashboard/admin-api";
import { DateRangeFields, EmptyPanel, ErrorPanel, PageHeading, PaginationControls, RefreshButton, TableSkeleton } from "@/features/dashboard/dashboard-ui";

const DAILY_PAGE_SIZE = 15;

interface RevenueReport {
  refreshedAt: string;
  from: string;
  to: string;
  timeZone: string;
  revenueVnd: number;
  paidOrderCount: number;
  excludedPaidOrderCount: number;
  daily: Array<{ date: string; revenueVnd: number; orders: number }>;
  packages: Array<{ packageId: string; revenueVnd: number; orders: number }>;
}

export default function RevenuePage() {
  const { controller } = useAdminAuth();
  const [range, setRange] = useState(currentMonthDates);
  const [applied, setApplied] = useState(range);
  const [data, setData] = useState<RevenueReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dailyPage, setDailyPage] = useState(1);

  useEffect(() => {
    const abort = new AbortController(); let active = true;
    void adminGet<RevenueReport>(`/api/admin/revenue?${dateQuery(applied.from, applied.to)}`, controller, abort.signal)
      .then((result) => { if (active) { setData(result); setFailed(false); } })
      .catch((error: unknown) => { if (active && !(error instanceof DOMException && error.name === "AbortError")) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; abort.abort(); };
  }, [applied, controller, refreshKey]);

  return <div className="admin-page">
    <PageHeading eyebrow="VERIFIED PAYMENT DATA" title="Revenue / Doanh thu"
      description="Revenue is counted once per valid PAID receipt using its historical VND amount. / Doanh thu tính một lần theo từng biên nhận PAID hợp lệ, dùng số tiền VND lịch sử."
      action={<RefreshButton onClick={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} busy={busy} />} />
    <section className="admin-filter-row"><DateRangeFields from={range.from} to={range.to} onFrom={(from) => setRange((current) => ({ ...current, from }))}
      onTo={(to) => setRange((current) => ({ ...current, to }))} onApply={() => { setBusy(true); setFailed(false); setDailyPage(1); setApplied(range); }} busy={busy} />
      <p className="admin-timezone"><BilingualText english="Inclusive dates · Asia/Ho_Chi_Minh · maximum 90 days" vietnamese="Ngày bao gồm cả hai đầu · múi giờ Việt Nam · tối đa 90 ngày" stack /></p></section>
    {failed ? <ErrorPanel onRetry={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} /> : busy && !data ? <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!"><TableSkeleton columns={3} rows={10} /></CardContent></Card> : data ? <>
      <section className="admin-metric-grid admin-revenue-metrics">
        <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5!"><p className="admin-metric-label"><BilingualText english="Payment revenue" vietnamese="Doanh thu thanh toán" /></p><p className="admin-metric-value">{formatVnd(data.revenueVnd)}</p><p className="admin-metric-detail"><BilingualText english="Fees and refunds are not deducted" vietnamese="Chưa trừ phí và hoàn tiền" /></p></CardContent></Card>
        <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5!"><p className="admin-metric-label"><BilingualText english="Verified paid orders" vietnamese="Đơn đã thanh toán hợp lệ" /></p><p className="admin-metric-value">{data.paidOrderCount.toLocaleString("en")}</p><p className="admin-metric-detail">{data.from} — {data.to}</p></CardContent></Card>
        <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5!"><p className="admin-metric-label"><BilingualText english="Needs reconciliation" vietnamese="Cần đối soát" /></p><p className="admin-metric-value">{data.excludedPaidOrderCount.toLocaleString("en")}</p><p className="admin-metric-detail"><BilingualText english="PAID records with incomplete receipt fields in this period" vietnamese="Đơn PAID thiếu trường biên nhận trong kỳ" stack /></p></CardContent></Card>
      </section>
      <section className="admin-content-grid">
        <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!">
          <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="DAY-BY-DAY" vietnamese="THEO NGÀY" /></p><h2><BilingualText english="Payment revenue and order count" vietnamese="Doanh thu thanh toán và số đơn" stack /></h2></div></div>
          {busy ? <TableSkeleton columns={3} /> : data.daily.length ? <>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><BilingualText english="Vietnam date" vietnamese="Ngày Việt Nam" /></th><th><BilingualText english="Revenue" vietnamese="Doanh thu" /></th><th><BilingualText english="Verified orders" vietnamese="Đơn hợp lệ" /></th></tr></thead>
              <tbody>{data.daily.slice((dailyPage - 1) * DAILY_PAGE_SIZE, dailyPage * DAILY_PAGE_SIZE).map((row) => <tr key={row.date}><td>{row.date}</td><td>{formatVnd(row.revenueVnd)}</td><td>{row.orders}</td></tr>)}</tbody></table></div>
            <PaginationControls page={dailyPage} pageSize={DAILY_PAGE_SIZE} total={data.daily.length} onPage={setDailyPage} disabled={busy} />
          </> : <EmptyPanel english="No dates in this report" vietnamese="Báo cáo không có ngày" />}
        </CardContent></Card>
        <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!">
          <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="HISTORICAL PACKAGE ID" vietnamese="MÃ GÓI LỊCH SỬ" /></p><h2><BilingualText english="Package breakdown" vietnamese="Phân bổ theo gói" /></h2></div></div>
          {data.packages.length ? <div className="admin-package-list">{data.packages.map((row, index) => <div className="admin-package-row" key={row.packageId}>
            <div className="admin-package-top"><span className="admin-package-index">0{index + 1}</span><div><strong>{row.packageId}</strong><small>{row.orders} <BilingualText english="verified orders" vietnamese="đơn hợp lệ" /></small></div><b>{formatVnd(row.revenueVnd)}</b></div>
            <div className="admin-progress"><span style={{ width: `${data.revenueVnd ? Math.round(row.revenueVnd / data.revenueVnd * 100) : 0}%` }} /></div>
          </div>)}</div> : <EmptyPanel english="No package sales in this period" vietnamese="Chưa có doanh số gói trong kỳ" />}
        </CardContent></Card>
      </section>
      <footer className="admin-page-footnote"><span><BilingualText english="Last refreshed" vietnamese="Làm mới lúc" />: {formatTimestamp(Date.parse(data.refreshedAt))}</span>
        <span><BilingualText english="Source: PAID order snapshots. This is gross payment revenue, not profit or MRR." vietnamese="Nguồn: snapshot đơn PAID. Đây là doanh thu thanh toán gộp, không phải lợi nhuận hoặc MRR." stack /></span></footer>
    </> : null}
  </div>;
}
