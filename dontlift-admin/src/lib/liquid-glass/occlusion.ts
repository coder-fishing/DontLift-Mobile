/* Adapted from the Crenspire Glass UI rendering contract; see docs/third-party-notices.md. */
export function clipsContent(style: CSSStyleDeclaration): boolean {
  const values = [style.overflow, style.overflowX, style.overflowY];
  return values.some((value) => value === "hidden" || value === "clip" || value === "scroll" || value === "auto")
    || style.contain.split(" ").includes("paint");
}

export function effectiveOpacity(element: HTMLElement): number {
  let opacity = 1;
  for (let current: HTMLElement | null = element; current && current !== document.body; current = current.parentElement) {
    opacity *= Number.parseFloat(getComputedStyle(current).opacity || "1");
  }
  return Math.max(0, Math.min(1, opacity));
}

export function insideClips(rect: DOMRect, clips: DOMRect[]): boolean {
  return clips.every((clip) => rect.left >= clip.left - 1 && rect.top >= clip.top - 1
    && rect.right <= clip.right + 1 && rect.bottom <= clip.bottom + 1);
}

export function paintsOverBackdrop(style: CSSStyleDeclaration): boolean {
  const background = style.backgroundColor;
  const hasColor = background !== "transparent" && background !== "rgba(0, 0, 0, 0)";
  const hasImage = style.backgroundImage !== "none";
  const hasBackdrop = style.backdropFilter !== "none" || style.getPropertyValue("-webkit-backdrop-filter") !== "none";
  return hasColor || hasImage || hasBackdrop;
}
