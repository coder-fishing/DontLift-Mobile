"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/glass/card";
import { BilingualText } from "@/features/auth/bilingual";
import { useAdminAuth } from "@/features/auth/auth-provider";
import { adminGet, formatTimestamp } from "@/features/dashboard/admin-api";
import { EmptyPanel, ErrorPanel, TableSkeleton } from "@/features/dashboard/dashboard-ui";

interface UserRow {
  uid: string | null;
  displayName?: string | null;
  email?: string | null;
  createdAt?: number | null;
  premiumExpiresAt?: number | null;
  premiumActive?: boolean;
  disabled?: boolean | null;
  profileExists?: boolean;
  authExists?: boolean;
}
interface UsersData { rows: UserRow[]; nextCursor: string | null; exactMatch: boolean; }

export default function UsersPage() {
  const { controller } = useAdminAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [data, setData] = useState<UsersData | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    const params = new URLSearchParams({ limit: "10" });
    if (search) params.set("q", search);
    if (cursor && !search) params.set("cursor", cursor);
    void adminGet<UsersData>(`/api/admin/users?${params}`, controller, abort.signal)
      .then((result) => { if (active) { setData(result); setFailed(false); } })
      .catch((error: unknown) => { if (active && !(error instanceof DOMException && error.name === "AbortError")) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; abort.abort(); };
  }, [controller, cursor, refreshKey, search]);

  const doSearch = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setFailed(false); setCursor(null); setSearch(searchInput.trim());
  }, [searchInput]);

  return <div className="admin-page admin-users-page">
    <Card material="regular" webgl className="admin-glass-card admin-users-search-card"><CardContent className="p-3! md:p-3!">
      <form className="admin-search-row" onSubmit={doSearch}>
        <input className="admin-search-input w-full max-w-lg" aria-label="Exact UID or email / UID hoặc email chính xác" placeholder="UID or email / UID hoặc email" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <Button type="submit" className="min-h-11 bg-[#087f69] text-white hover:bg-[#066957] hover:text-white"><BilingualText english="Search" vietnamese="Tìm" /></Button>
        {search && <Button type="button" variant="outline" className="min-h-11" onClick={() => { setBusy(true); setFailed(false); setSearchInput(""); setSearch(""); setCursor(null); }}><BilingualText english="Clear search" vietnamese="Xóa tìm kiếm" /></Button>}
      </form>
    </CardContent></Card>

    {failed ? <ErrorPanel onRetry={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} /> : busy && !data ? <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!"><TableSkeleton columns={7} /></CardContent></Card> : data ? <Card material="regular" webgl className="admin-glass-card"><CardContent className="p-5! md:p-6!">
      <div className="admin-section-heading"><div><p className="admin-eyebrow"><BilingualText english="USER DIRECTORY" vietnamese="DANH SÁCH NGƯỜI DÙNG" /></p>
        <h2><BilingualText english={search ? "Exact result" : "Profiles"} vietnamese={search ? "Kết quả chính xác" : "Hồ sơ"} /></h2></div>
        <Button variant="outline" className="min-h-10" onClick={() => { setBusy(true); setFailed(false); setRefreshKey((value) => value + 1); }} disabled={busy}><BilingualText english="Refresh" vietnamese="Làm mới" /></Button></div>
      {busy ? <TableSkeleton columns={7} /> : data.rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr>
        <th><BilingualText english="Name" vietnamese="Tên" /></th><th>Email</th><th>UID</th><th><BilingualText english="Created" vietnamese="Ngày tạo" /></th>
        <th><BilingualText english="Premium expires" vietnamese="Premium hết hạn" /></th><th><BilingualText english="Auth status" vietnamese="Trạng thái Auth" /></th><th /></tr></thead>
        <tbody>{data.rows.map((user, index) => <tr key={user.uid ?? `not-found-${index}`}>
          <td>{user.displayName ?? "—"}{user.profileExists === false && <small className="block text-amber-800"><BilingualText english="Profile missing" vietnamese="Thiếu hồ sơ" /></small>}</td>
          <td>{user.email ?? "—"}</td><td className="font-mono">{user.uid ?? "—"}</td><td>{formatTimestamp(user.createdAt ?? null)}</td>
          <td>{user.premiumExpiresAt !== null && user.premiumExpiresAt !== undefined ? <>{formatTimestamp(user.premiumExpiresAt)}{user.premiumActive && <span className="admin-status status-paid ml-2"><BilingualText english="Active" vietnamese="Còn hạn" /></span>}</> : "—"}</td>
          <td>{user.authExists === false ? <span className="admin-status"><BilingualText english="Auth missing" vietnamese="Thiếu Auth" /></span>
            : user.disabled === null ? "—" : user.disabled ? <span className="admin-status status-cancelled"><BilingualText english="Disabled" vietnamese="Đã khóa" /></span> : <span className="admin-status status-paid"><BilingualText english="Enabled" vietnamese="Đang hoạt động" /></span>}</td>
          <td>{user.uid && <Link className="admin-text-link" href={`/users/${encodeURIComponent(user.uid)}`}><BilingualText english="Inspect" vietnamese="Chi tiết" /></Link>}</td>
        </tr>)}</tbody></table></div> : <EmptyPanel english={search ? "No matching account found" : "No user profiles found"} vietnamese={search ? "Không tìm thấy tài khoản khớp" : "Chưa có hồ sơ người dùng"} />}
      {!search && <div className="admin-pagination"><Button variant="outline" className="min-h-11" disabled={!cursor || busy} onClick={() => { setBusy(true); setCursor(null); }}><BilingualText english="First page" vietnamese="Trang đầu" /></Button>
        <Button className="min-h-11 bg-[#087f69] text-white hover:bg-[#066957] hover:text-white" disabled={!data.nextCursor || busy} onClick={() => { setBusy(true); setCursor(data.nextCursor); }}><BilingualText english="Next page" vietnamese="Trang sau" /></Button></div>}
    </CardContent></Card> : null}
  </div>;
}
