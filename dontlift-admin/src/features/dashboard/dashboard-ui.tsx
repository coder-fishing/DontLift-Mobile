"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/glass/card";
import { BilingualText } from "@/features/auth/bilingual";

export function PageHeading({
  eyebrow, title, description, action,
}: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="admin-page-heading">
      <div><p className="admin-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

export function LoadingPanel({ label = "Loading workspace data" }: { label?: string }) {
  return <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-6!">
    <div className="admin-loading" role="status"><span className="admin-spinner" aria-hidden="true" />
      <BilingualText english={label} vietnamese="Đang tải dữ liệu" />
    </div>
  </CardContent></Card>;
}

export function TableSkeleton({ columns, rows = 7 }: { columns: number; rows?: number }) {
  return <div className="admin-table-wrap" aria-busy="true">
    <table className="admin-table admin-skeleton-table" aria-hidden="true">
      <thead><tr>{Array.from({ length: columns }, (_, index) => <th key={index}><span className="admin-skeleton-line admin-skeleton-heading" /></th>)}</tr></thead>
      <tbody>{Array.from({ length: rows }, (_, row) => <tr key={row}>{Array.from({ length: columns }, (_, column) =>
        <td key={column}><span className="admin-skeleton-line" /></td>)}</tr>)}</tbody>
    </table>
    <p className="sr-only" role="status"><BilingualText english="Loading records" vietnamese="Đang tải dữ liệu" /></p>
  </div>;
}

export function PaginationControls({
  page, pageSize, total, onPage, disabled = false,
}: { page: number; pageSize: number; total: number; onPage: (page: number) => void; disabled?: boolean }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  return <div className="admin-pagination admin-pagination-between">
    <p className="admin-pagination-summary"><BilingualText
      english={`Showing ${from}–${to} of ${total}`}
      vietnamese={`Đang xem ${from}–${to} trên ${total}`} /></p>
    <div className="flex gap-2">
      <Button variant="outline" className="min-h-10" disabled={disabled || current <= 1} onClick={() => onPage(1)}><BilingualText english="First" vietnamese="Đầu" /></Button>
      <Button variant="outline" className="min-h-10" disabled={disabled || current <= 1} onClick={() => onPage(current - 1)}><BilingualText english="Previous" vietnamese="Trước" /></Button>
      <span className="admin-page-number" aria-live="polite"><BilingualText english={`Page ${current} of ${pageCount}`} vietnamese={`Trang ${current} trên ${pageCount}`} /></span>
      <Button variant="outline" className="min-h-10" disabled={disabled || current >= pageCount} onClick={() => onPage(current + 1)}><BilingualText english="Next" vietnamese="Sau" /></Button>
      <Button variant="outline" className="min-h-10" disabled={disabled || current >= pageCount} onClick={() => onPage(pageCount)}><BilingualText english="Last" vietnamese="Cuối" /></Button>
    </div>
  </div>;
}

export function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return <Card material="regular" webgl className="admin-glass-card admin-error-card"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5!">
    <div className="flex items-start gap-3"><AlertCircle size={19} className="mt-0.5 text-rose-700" aria-hidden="true" />
      <div><h2><BilingualText english="Data could not be loaded" vietnamese="Không tải được dữ liệu" /></h2>
        <p><BilingualText english="Check the selected filters, connection, or Firestore access, then retry." vietnamese="Kiểm tra bộ lọc, kết nối hoặc quyền Firestore rồi thử lại." stack /></p></div></div>
    <Button variant="outline" className="min-h-11" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /><BilingualText english="Retry" vietnamese="Thử lại" /></Button>
  </CardContent></Card>;
}

export function EmptyPanel({ english, vietnamese }: { english: string; vietnamese: string }) {
  return <div className="admin-empty"><span className="admin-empty-mark" aria-hidden="true">—</span><p><BilingualText english={english} vietnamese={vietnamese} /></p></div>;
}

export function DateRangeFields({
  from, to, onFrom, onTo, onApply, busy = false,
}: { from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void; onApply: () => void; busy?: boolean }) {
  return <form className="admin-date-range" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
    <label><span><BilingualText english="From" vietnamese="Từ ngày" /></span><input aria-label="From date / Từ ngày" type="date" value={from} onChange={(event) => onFrom(event.target.value)} /></label>
    <label><span><BilingualText english="To" vietnamese="Đến ngày" /></span><input aria-label="To date / Đến ngày" type="date" value={to} onChange={(event) => onTo(event.target.value)} /></label>
    <Button type="submit" className="min-h-11" disabled={busy}><BilingualText english="Apply" vietnamese="Áp dụng" /></Button>
  </form>;
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return <Button variant="outline" className="min-h-11" onClick={onClick} disabled={busy}>
    <RefreshCw size={16} className={busy ? "animate-spin" : ""} aria-hidden="true" />
    <BilingualText english="Refresh" vietnamese="Làm mới" />
  </Button>;
}
