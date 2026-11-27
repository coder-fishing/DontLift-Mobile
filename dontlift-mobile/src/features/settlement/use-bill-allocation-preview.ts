import { useMemo } from 'react';
import {
  calculateBillSharesWithOverrides,
  calculateDefaultBillShares,
  type BillShareOverride,
} from './bill-allocation';
import type { PublishedBill } from './bill-repository';
import type { BillAllocationMember } from './components/BillShareListRow';
import type { OverrideDraft } from './components/OverrideMemberEditor';

type Options = {
  members: readonly BillAllocationMember[];
  host: boolean;
  validTotal: boolean;
  parsedTotal: number;
  initialSplitMode: 'ROOM_SCORE' | 'CUSTOM_PERCENT';
  initialPercentDrafts: Record<string, string>;
  overrideDrafts: Record<string, OverrideDraft>;
  confirmedBill: PublishedBill | null;
  canOverride: boolean;
  isEditingOverrides: boolean;
};

export function useBillAllocationPreview({
  members,
  host,
  validTotal,
  parsedTotal,
  initialSplitMode,
  initialPercentDrafts,
  overrideDrafts,
  confirmedBill,
  canOverride,
  isEditingOverrides,
}: Options) {
  const customOrder = useMemo(
    () =>
      [...members].sort(
        (left, right) =>
          left.penaltyScore - right.penaltyScore ||
          left.displayName.localeCompare(right.displayName) ||
          left.uid.localeCompare(right.uid),
      ),
    [members],
  );
  const initialPercentOverrides = useMemo(() => {
    if (initialSplitMode !== 'CUSTOM_PERCENT')
      return {
        entries: undefined as BillShareOverride[] | undefined,
        error: undefined as string | undefined,
        totalBps: 0,
      };
    const entries: BillShareOverride[] = [];
    let totalBps = 0;
    for (const member of members) {
      const raw = (initialPercentDrafts[member.uid] ?? '').trim();
      if (!raw || !/^\d{1,3}(?:\.\d{1,2})?$/.test(raw))
        return {
          entries: undefined,
          error: 'Enter a percentage for every member (0–100, up to 2 decimals).',
          totalBps,
        };
      const value = Math.round(Number(raw) * 100);
      if (value > 10_000)
        return { entries: undefined, error: 'A member percentage cannot exceed 100%.', totalBps };
      totalBps += value;
      entries.push({ uid: member.uid, type: 'PERCENT_BPS', value });
    }
    if (totalBps !== 10_000)
      return {
        entries: undefined,
        error: `Percentages must total 100% (currently ${(totalBps / 100).toFixed(2)}%).`,
        totalBps,
      };
    return { entries, error: undefined, totalBps };
  }, [initialSplitMode, initialPercentDrafts, members]);
  const preview = useMemo(() => {
    if (!host || !validTotal || members.length === 0) return null;
    try {
      if (initialSplitMode === 'CUSTOM_PERCENT') {
        if (!initialPercentOverrides.entries) return null;
        return calculateBillSharesWithOverrides(
          parsedTotal,
          members,
          initialPercentOverrides.entries,
        );
      }
      return calculateDefaultBillShares(parsedTotal, members);
    } catch {
      return null;
    }
  }, [host, validTotal, parsedTotal, members, initialSplitMode, initialPercentOverrides]);
  const customInputRows = useMemo(
    () =>
      customOrder.map((member, index) => ({
        uid: member.uid,
        shareVnd: preview?.shares.find(share => share.uid === member.uid)?.shareVnd ?? 0,
        rank: index + 1,
      })),
    [customOrder, preview],
  );
  const parsedOverrides = useMemo(() => {
    const overrides: BillShareOverride[] = [];
    for (const [uid, draft] of Object.entries(overrideDrafts)) {
      const raw = draft.value.trim();
      if (!raw) return { entries: null, message: 'Enter a value for each custom amount.' };
      let value: number;
      if (draft.type === 'PERCENT_BPS') {
        if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw))
          return { entries: null, message: 'Use a percentage from 0 to 100, with up to two decimal places.' };
        value = Math.round(Number(raw) * 100);
        if (value > 10_000)
          return { entries: null, message: 'A member percentage cannot be greater than 100%.' };
      } else {
        if (!/^\d+$/.test(raw))
          return { entries: null, message: 'Enter a whole VND amount.' };
        value = Number(raw);
        if (!Number.isSafeInteger(value))
          return { entries: null, message: 'The VND amount is too large.' };
      }
      overrides.push({ uid, type: draft.type, value });
    }
    return { entries: overrides, message: undefined };
  }, [overrideDrafts]);
  const overridePreview = useMemo(() => {
    if (!canOverride || !isEditingOverrides || parsedOverrides.entries === null)
      return null;
    if (parsedOverrides.entries.length === 0) return confirmedBill;
    try {
      return calculateBillSharesWithOverrides(
        confirmedBill!.totalBillVnd,
        members,
        parsedOverrides.entries,
      );
    } catch {
      return null;
    }
  }, [canOverride, confirmedBill, isEditingOverrides, members, parsedOverrides]);
  const overrideTotalMismatch = Boolean(
    isEditingOverrides &&
      parsedOverrides.entries?.length &&
      !overridePreview &&
      !parsedOverrides.message,
  );
  const displayedShares: readonly PublishedBill['shares'][number][] =
    canOverride && isEditingOverrides && overridePreview
      ? overridePreview.shares
      : confirmedBill?.shares ?? preview?.shares ?? [];

  return {
    customInputRows,
    customOrder,
    displayedShares,
    initialPercentOverrides,
    overridePreview,
    overrideTotalMismatch,
    parsedOverrides,
    preview,
  };
}
