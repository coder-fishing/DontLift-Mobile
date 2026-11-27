import type { ReactNode } from "react";

export function BilingualText({
  english,
  vietnamese,
  className,
  stack = false,
}: {
  english: ReactNode;
  vietnamese: ReactNode;
  className?: string;
  stack?: boolean;
}) {
  return (
    <span className={className}>
      <span>{english}</span>
      {!stack && <span aria-hidden="true"> / </span>}
      <span lang="vi" className={stack ? "block" : undefined}>{vietnamese}</span>
    </span>
  );
}
