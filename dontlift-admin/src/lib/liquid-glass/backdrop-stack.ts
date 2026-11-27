/* Adapted from the Crenspire Glass UI rendering contract; see docs/third-party-notices.md. */
export interface BackdropEntry<T> {
  id: number;
  src: T;
  live?: boolean;
  base?: boolean;
}

export function pushBackdrop<T>(stack: BackdropEntry<T>[], entry: BackdropEntry<T>): BackdropEntry<T>[] {
  const next = [...stack.filter((item) => item.id !== entry.id), entry];
  return next.sort((left, right) => Number(Boolean(left.base)) - Number(Boolean(right.base)));
}

export function popBackdrop<T>(stack: BackdropEntry<T>[], id: number): BackdropEntry<T>[] {
  return stack.filter((entry) => entry.id !== id);
}
