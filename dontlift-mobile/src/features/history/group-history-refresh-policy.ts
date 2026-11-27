/** Quyết định có cần tải lại lịch sử nhóm sau khi mạng vừa kết nối lại hay không. */
export function shouldRefreshGroupHistoryOnReconnect(
  previousOnline: boolean | null,
  nextOnline: boolean,
): boolean {
  return previousOnline === false && nextOnline;
}
