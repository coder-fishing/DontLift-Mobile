"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CreditCard, Users, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/glass/card";
import { BilingualText } from "@/features/auth/bilingual";
import { useAdminAuth } from "@/features/auth/auth-provider";
import { adminGet, currentMonthDates, dateQuery, formatTimestamp, formatVnd } from "@/features/dashboard/admin-api";
import { DateRangeFields, EmptyPanel, ErrorPanel, PageHeading, PaginationControls, RefreshButton, TableSkeleton } from "@/features/dashboard/dashboard-ui";

const DAILY_PAGE_SIZE = 15;

interface OrderRow {
  orderCode: string;
  uid: string | null;
  packageId: string | null;
  amountVnd: number | null;
  status: string | null;
  createdAt: number | null;
  paidAt: number | null;
  grantedExpiresAt: number | null;
  receiptValid: boolean;
}
interface RevenueData {
  from: string;
  to: string;
  timeZone: string;
  revenueVnd: number;
  paidOrderCount: number;
  excludedPaidOrderCount: number;
  daily: Array<{ date: string; revenueVnd: number; orders: number }>;
  packages: Array<{ packageId: string; revenueVnd: number; orders: number }>;
}
interface OverviewData {
  refreshedAt: string;
  profileCount: number;
  activePremiumCount: number;
  revenue: RevenueData;
  latestOrders: OrderRow[];
}

function MetricCard({
  label, value, detail, icon: Icon, tone = "neutral",
}: { label: React.ReactNode; value: React.ReactNode; detail: React.ReactNode; icon: typeof Users; tone?: "neutral" | "green" | "blue" }) {
  return <Card material="regular" webgl className={`admin-glass-card admin-metric-card tone-${tone}`}>
    <CardContent className="p-5!">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="admin-metric-label">{label}</p><p className="admin-metric-value">{value}</p></div>
        <span className="admin-metric-icon"><Icon size={19} aria-hidden="true" /></span></div>
      <p className="admin-metric-detail">{detail}</p>
    </CardContent>
  </Card>;
}

function makeChartAxis(maxValue: number, integer = false) {
  const max = Math.max(0, maxValue);
  if (max === 0) return { max: 1, ticks: [{ value: 0, y: 155 }] };
  if (integer && max <= 3) {
    return {
      max: Math.max(1, max),
      ticks: Array.from({ length: max + 1 }, (_, index) => ({
        value: max - index,
        y: max === 0 ? 155 : 20 + (index / max) * 135,
      })),
    };
  }

  const roughStep = Math.max(max, 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const intervals = integer ? [1, 2, 3, 5, 10] : [1, 2, 2.5, 3, 5, 10];
  const step = (intervals.find((interval) => normalized <= interval) ?? 10) * magnitude;
  const axisMax = step * 3;

  return {
    max: axisMax,
    ticks: [3, 2, 1, 0].map((level, index) => ({ value: level * step, y: 20 + index * 45 })),
  };
}

function formatRevenueTick(value: number) {
  const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return `${compact} ₫`;
}

function RevenueChart({ data, busy }: { data: RevenueData; busy: boolean }) {
  const [page, setPage] = useState(1);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(data.daily.length / DAILY_PAGE_SIZE)));
  const axis = makeChartAxis(Math.max(0, ...data.daily.map((item) => item.revenueVnd)));
  const points = data.daily.map((item, index) => {
    const x = data.daily.length <= 1 ? 50 : 12 + (index / (data.daily.length - 1)) * 976;
    const y = 155 - (item.revenueVnd / axis.max) * 135;
    return `${x},${y}`;
  }).join(" ");
  const hasRevenue = data.daily.some((item) => item.revenueVnd > 0);
  return <div>
    <div className="admin-chart-plot">
      <div className="admin-chart-y-axis" aria-hidden="true">{axis.ticks.map((tick) => <span key={`${tick.value}-${tick.y}`}>{formatRevenueTick(tick.value)}</span>)}</div>
      <div className="admin-chart-wrap">
        {hasRevenue ? <svg viewBox="0 0 1000 180" role="img" aria-labelledby="revenue-chart-title revenue-chart-desc" preserveAspectRatio="none">
          <title id="revenue-chart-title">Daily payment revenue / Doanh thu thanh toán theo ngày</title>
          <desc id="revenue-chart-desc">Payment revenue in VND grouped by day in Vietnam time / Doanh thu thanh toán VND theo ngày giờ Việt Nam.</desc>
          <defs><linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--admin-chart)" stopOpacity=".25" /><stop offset="100%" stopColor="var(--admin-chart)" stopOpacity="0" /></linearGradient></defs>
          <path d={`M ${points.replaceAll(" ", " L ")} L 988,170 L 12,170 Z`} fill="url(#revenue-fill)" />
          {axis.ticks.map((tick) => <line key={tick.y} x1="12" x2="988" y1={tick.y} y2={tick.y} className="admin-chart-grid" />)}
          <polyline points={points} fill="none" stroke="var(--admin-chart)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg> : <div className="admin-chart-no-data"><span aria-hidden="true">—</span><BilingualText english="No verified payments in this period" vietnamese="Chưa có thanh toán đã xác minh trong kỳ" /></div>}
      </div>
    </div>
    <div className="admin-chart-axis admin-chart-axis-offset"><span>{data.daily[0]?.date ?? data.from}</span><span>{data.daily.at(-1)?.date ?? data.to}</span></div>
    <details className="admin-chart-data">
      <summary><BilingualText english="View chart data" vietnamese="Xem dữ liệu biểu đồ" /></summary>
      {busy ? <TableSkeleton columns={3} /> : <>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><BilingualText english="Vietnam date" vietnamese="Ngày Việt Nam" /></th><th><BilingualText english="Revenue" vietnamese="Doanh thu" /></th><th><BilingualText english="Paid orders" vietnamese="Đơn đã thanh toán" /></th></tr></thead>
          <tbody>{data.daily.slice((currentPage - 1) * DAILY_PAGE_SIZE, currentPage * DAILY_PAGE_SIZE).map((item) => <tr key={item.date}><td>{item.date}</td><td>{formatVnd(item.revenueVnd)}</td><td>{item.orders}</td></tr>)}</tbody></table></div>
        <PaginationControls page={currentPage} pageSize={DAILY_PAGE_SIZE} total={data.daily.length} onPage={setPage} />
      </>}
    </details>
  </div>;
}

function DailyPaidOrdersChart({ data }: { data: RevenueData }) {
  const axis = makeChartAxis(Math.max(0, ...data.daily.map((item) => item.orders)), true);
  const slotWidth = data.daily.length > 0 ? 976 / data.daily.length : 976;
  const barWidth = Math.max(2, Math.min(26, slotWidth * 0.56));
  const hasOrders = data.daily.some((item) => item.orders > 0);

  return <div>
    <div className="admin-chart-plot">
      <div className="admin-chart-y-axis" aria-hidden="true">{axis.ticks.map((tick) => <span key={`${tick.value}-${tick.y}`}>{new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(tick.value)}</span>)}</div>
      <div className="admin-chart-wrap">
        {hasOrders ? <svg viewBox="0 0 1000 180" role="img" aria-labelledby="orders-chart-title orders-chart-desc" preserveAspectRatio="none">
          <title id="orders-chart-title">Daily paid orders / Đơn thanh toán theo ngày</title>
          <desc id="orders-chart-desc">Verified paid order count for each date in the selected range, using Vietnam time / Số đơn đã thanh toán hợp lệ theo từng ngày trong khoảng đã chọn, theo giờ Việt Nam.</desc>
          {axis.ticks.map((tick) => <line key={tick.y} x1="12" x2="988" y1={tick.y} y2={tick.y} className="admin-chart-grid" />)}
          {data.daily.map((item, index) => {
            const centerX = data.daily.length <= 1 ? 500 : 12 + ((index + 0.5) / data.daily.length) * 976;
            const height = item.orders === 0 ? 0 : Math.max(2, (item.orders / axis.max) * 135);
            return item.orders > 0 ? <rect key={item.date} x={centerX - barWidth / 2} y={155 - height} width={barWidth} height={height} rx="2" fill="var(--admin-chart)" opacity=".78">
              <title>{`${item.date}: ${item.orders} paid order(s) / ${item.orders} đơn đã thanh toán`}</title>
            </rect> : null;
          })}
        </svg> : <div className="admin-chart-no-data"><span aria-hidden="true">—</span><BilingualText english="No verified paid orders in this period" vietnamese="Chưa có đơn thanh toán hợp lệ trong kỳ" /></div>}
      </div>
    </div>
    <div className="admin-chart-axis admin-chart-axis-offset"><span>{data.daily[0]?.date ?? data.from}</span><span>{data.daily.at(-1)?.date ?? data.to}</span></div>
    <details className="admin-chart-data">
      <summary><BilingualText english="View chart data" vietnamese="Xem dữ liệu biểu đồ" /></summary>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><BilingualText english="Vietnam date" vietnamese="Ngày Việt Nam" /></th><th><BilingualText english="Paid orders" vietnamese="Đơn đã thanh toán" /></th></tr></thead>
        <tbody>{data.daily.map((item) => <tr key={item.date}><td>{item.date}</td><td>{item.orders}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}

export default function DashboardPage() {
  const { controller } = useAdminAuth();
  const [range, setRange] = useState(currentMonthDates);
  const [appliedRange, setAppliedRange] = useState(range);
  const [data, setData] = useState<OverviewData | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    void adminGet<OverviewData>(`/api/admin/overview?${dateQuery(appliedRange.from, appliedRange.to)}`, controller, abort.signal)
      .then((result) => { if (active) { setData(result); setFailed(false); } })
      .catch((error: unknown) => { if (active && !(error instanceof DOMException && error.name === "AbortError")) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; abort.abort(); };
  }, [appliedRange, controller, refreshKey]);

  const chartSummary = useMemo(() => data?.revenue.daily.reduce((sum, item) => sum + item.orders, 0) ?? 0, [data]);

  return <div className="admin-page">
    <PageHeading
      eyebrow="DONTLIFT / OPERATIONS"
      title="Overview / Tổng quan"
      description="A current view of users and verified payments. / Tổng quan người dùng và thanh toán đã xác minh."
      action={<RefreshButton onClick={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} busy={busy} />}
    />

    <section className="admin-filter-row" aria-label="Report date range">
      <DateRangeFields from={range.from} to={range.to} onFrom={(from) => setRange((current) => ({ ...current, from }))}
      onTo={(to) => setRange((current) => ({ ...current, to }))} onApply={() => { setBusy(true); setFailed(false); setAppliedRange(range); }} busy={busy} />
      <p className="admin-timezone"><BilingualText english="All report dates use Vietnam time (UTC+7)." vietnamese="Ngày báo cáo theo giờ Việt Nam (UTC+7)." stack /></p>
    </section>

    {failed ? <ErrorPanel onRetry={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} /> : busy && !data ? <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!"><TableSkeleton columns={5} rows={8} /></CardContent></Card> : data ? <>
      <section className="admin-metric-grid" aria-label="Overview metrics">
        <MetricCard label={<BilingualText english="User profiles" vietnamese="Hồ sơ người dùng" />} value={new Intl.NumberFormat("en").format(data.profileCount)}
          detail={<BilingualText english="Snapshot at refresh time" vietnamese="Số liệu tại thời điểm làm mới" />} icon={Users} />
        <MetricCard label={<BilingualText english="Active Premium" vietnamese="Premium còn hạn" />} value={new Intl.NumberFormat("en").format(data.activePremiumCount)}
          detail={<BilingualText english="Based on expiration after now" vietnamese="Theo thời hạn lớn hơn hiện tại" />} icon={ArrowUpRight} tone="green" />
        <MetricCard label={<BilingualText english="Payment revenue" vietnamese="Doanh thu thanh toán" />} value={formatVnd(data.revenue.revenueVnd)}
          detail={<BilingualText english={`Excludes fees and refunds · ${data.revenue.paidOrderCount} verified orders`} vietnamese={`Chưa trừ phí/hoàn tiền · ${data.revenue.paidOrderCount} đơn hợp lệ`} stack />}
          icon={Wallet} tone="blue" />
        <MetricCard label={<BilingualText english="Paid orders" vietnamese="Đơn đã thanh toán" />} value={new Intl.NumberFormat("en").format(data.revenue.paidOrderCount)}
          detail={<BilingualText english={`Period count · ${chartSummary} shown in chart`} vietnamese={`Theo kỳ · ${chartSummary} đơn trên biểu đồ`} stack />} icon={CreditCard} />
      </section>

      <section className="admin-content-grid admin-daily-chart-grid">
        <Card material="regular" webgl className="admin-glass-card admin-chart-card">
          <CardContent className="p-5! md:p-6!">
            <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="VERIFIED RECEIPTS" vietnamese="BIÊN NHẬN HỢP LỆ" /></p>
              <h2><BilingualText english="Daily payment revenue" vietnamese="Doanh thu thanh toán theo ngày" stack /></h2></div>
              <span className="admin-range-label">{data.revenue.from} — {data.revenue.to}</span></div>
            <RevenueChart key={`${data.revenue.from}:${data.revenue.to}`} data={data.revenue} busy={busy} />
            {data.revenue.excludedPaidOrderCount > 0 && <p className="admin-reconciliation"><BilingualText
              english={`${data.revenue.excludedPaidOrderCount} PAID order(s) were excluded because receipt fields were incomplete.`}
              vietnamese={`${data.revenue.excludedPaidOrderCount} đơn PAID bị loại do thiếu trường biên nhận.`} stack /></p>}
          </CardContent>
        </Card>
        <Card material="regular" webgl className="admin-glass-card admin-chart-card">
          <CardContent className="p-5! md:p-6!">
            <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="ORDER VOLUME" vietnamese="SỐ LƯỢNG ĐƠN" /></p>
                <h2><BilingualText english="Paid orders by day" vietnamese="Đơn thanh toán theo ngày" stack /></h2></div>
              <span className="admin-range-label">{data.revenue.from} — {data.revenue.to}</span></div>
            <DailyPaidOrdersChart data={data.revenue} />
          </CardContent>
        </Card>
      </section>
      <Card material="regular" webgl className="admin-glass-card admin-package-card">
          <CardContent className="p-5! md:p-6!">
            <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="VERIFIED RECEIPTS" vietnamese="BIÊN NHẬN HỢP LỆ" /></p>
              <h2><BilingualText english="Revenue by package" vietnamese="Doanh thu theo gói" /></h2></div></div>
            {data.revenue.packages.length ? <ul className="admin-package-chart" aria-label="Revenue by package / Doanh thu theo gói">{data.revenue.packages.map((item) => {
              const maxRevenue = Math.max(1, ...data.revenue.packages.map((pkg) => pkg.revenueVnd));
              const width = Math.round(item.revenueVnd / maxRevenue * 100);
              return <li className="admin-package-chart-row" key={item.packageId}>
                <div className="admin-package-chart-label"><div><strong>{item.packageId.replace("MONTH_", "")} <BilingualText english="month" vietnamese="tháng" /></strong>
                  <small>{item.orders} <BilingualText english="verified orders" vietnamese="đơn hợp lệ" /></small></div><b>{formatVnd(item.revenueVnd)}</b></div>
                <div className="admin-package-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
              </li>;
            })}</ul> : <EmptyPanel english="No verified package sales in this period" vietnamese="Chưa có doanh số gói hợp lệ trong kỳ" />}
          </CardContent>
      </Card>

      <Card material="regular" webgl className="admin-glass-card admin-recent-card">
        <CardContent className="p-5! md:p-6!">
          <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="LATEST ACTIVITY" vietnamese="HOẠT ĐỘNG GẦN ĐÂY" /></p>
            <h2><BilingualText english="Recent orders" vietnamese="Đơn hàng gần đây" /></h2></div><a className="admin-text-link" href="/orders"><BilingualText english="View all orders" vietnamese="Xem tất cả đơn hàng" /></a></div>
          {busy ? <TableSkeleton columns={5} rows={5} /> : data.latestOrders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr>
            <th><BilingualText english="Order" vietnamese="Mã đơn" /></th><th><BilingualText english="Package" vietnamese="Gói" /></th>
            <th><BilingualText english="Amount" vietnamese="Số tiền" /></th><th><BilingualText english="Status" vietnamese="Trạng thái" /></th>
            <th><BilingualText english="Created" vietnamese="Ngày tạo" /></th></tr></thead><tbody>{data.latestOrders.map((order) => <tr key={order.orderCode}>
              <td className="font-mono">{order.orderCode}</td><td>{order.packageId?.replace("MONTH_", "")} <BilingualText english="month" vietnamese="tháng" /></td>
              <td>{formatVnd(order.amountVnd)}</td><td><span className={`admin-status status-${order.status?.toLowerCase() ?? "unknown"}`}>{order.status ?? "—"}</span></td>
              <td>{formatTimestamp(order.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyPanel english="No recent orders found" vietnamese="Không tìm thấy đơn gần đây" />}
        </CardContent>
      </Card>
      <footer className="admin-page-footnote"><span><BilingualText english="Last refreshed" vietnamese="Làm mới lúc" />: {formatTimestamp(Date.parse(data.refreshedAt))}</span>
        <span><BilingualText english="Payment revenue uses server-confirmed paidAt and historical order values." vietnamese="Doanh thu dùng paidAt đã xác minh và giá trị lịch sử của đơn." stack /></span></footer>
    </> : null}
  </div>;
}
