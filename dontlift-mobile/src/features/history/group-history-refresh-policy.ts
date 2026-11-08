export function shouldRefreshGroupHistoryOnReconnect(previousOnline: boolean | null, nextOnline: boolean): boolean {
  return previousOnline === false && nextOnline;
}
