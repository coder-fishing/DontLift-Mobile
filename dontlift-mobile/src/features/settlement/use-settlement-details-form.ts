import { useCallback, useEffect, useState } from 'react';
import type {
  SettlementDetails,
  SettlementDetailsError,
  SettlementDetailsInput,
} from './settlement-details-repository';
import type { BankOption } from './bank-directory';

export type SettlementDetailsFields = Pick<SettlementDetailsInput, 'bankId' | 'accountNumber' | 'accountName'>;
export type SettlementDetailsRepositoryPort = {
  read: (roomId: string) => Promise<SettlementDetails | null>;
  save: (input: SettlementDetailsInput) => Promise<{ version: 1; roomId: string; expiresAtUtcMs: number }>;
};
export type BankDirectoryPort = { list: () => Promise<BankOption[]> };

const EMPTY_FIELDS: SettlementDetailsFields = { bankId: '', accountNumber: '', accountName: '' };

export function getSettlementFieldError(key: keyof SettlementDetailsFields, value: string): string | undefined {
  const trimmed = value.trim();
  const limit = key === 'bankId' ? 32 : key === 'accountNumber' ? 64 : 100;
  if (!trimmed) return 'This field is required.';
  if (trimmed.length > limit) return `Use ${limit} characters or fewer.`;
  return undefined;
}

function saveErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as SettlementDetailsError).code
    : undefined;
  if (code === 'permission-denied') return 'Only the Host can save details after scores are finalized.';
  if (code === 'failed-precondition') return 'Settlement details unlock after the room scores are finalized.';
  if (code === 'invalid-argument') return 'Check the fields and try again.';
  if (code === 'unauthenticated') return 'Your sign-in expired. Sign in again and retry.';
  return 'Could not save to Firebase. Reconnect and retry; no offline write was queued.';
}

export function useSettlementDetailsForm({
  roomId,
  mode,
  repository,
  bankDirectory,
  onSaved,
  hasContinueAction,
}: {
  roomId: string;
  mode: 'host' | 'member';
  repository: SettlementDetailsRepositoryPort;
  bankDirectory: BankDirectoryPort;
  onSaved: (details: SettlementDetails) => void;
  hasContinueAction: boolean;
}) {
  const [fields, setFields] = useState<SettlementDetailsFields>(EMPTY_FIELDS);
  const [details, setDetails] = useState<SettlementDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [touched, setTouched] = useState<Partial<Record<keyof SettlementDetailsFields, boolean>>>({});
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [manualBankEntry, setManualBankEntry] = useState(false);
  const isDirty = details
    ? fields.bankId.trim() !== details.bankId || fields.accountNumber.trim() !== details.accountNumber
      || fields.accountName.trim() !== details.accountName
    : Boolean(fields.bankId.trim() || fields.accountNumber.trim() || fields.accountName.trim());
  const canContinueWithoutSaving = Boolean(details && !isDirty && hasContinueAction);

  useEffect(() => {
    if (!fields.bankId) {
      setSelectedBank(null);
      return;
    }
    const match = banks.find(bank => bank.bin === fields.bankId);
    setSelectedBank(match ?? null);
  }, [banks, fields.bankId]);

  const loadBanks = useCallback(async () => {
    setBankLoading(true);
    setBankError(false);
    try {
      setBanks(await bankDirectory.list());
    } catch {
      setBankError(true);
    } finally {
      setBankLoading(false);
    }
  }, [bankDirectory]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void repository.read(roomId).then(value => {
      if (!active) return;
      setDetails(value);
      if (value) {
        setFields({ bankId: value.bankId, accountNumber: value.accountNumber, accountName: value.accountName });
        setSelectedBank(null);
      }
      if (value && /^\d{6}$/.test(value.bankId)) void loadBanks();
    }).catch(() => {
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [mode, repository, roomId, loadBanks]);

  const change = (key: keyof SettlementDetailsFields, value: string) => {
    setFields(current => ({ ...current, [key]: value }));
    setSaveError(undefined);
  };

  const submit = async () => {
    const errors = (Object.keys(fields) as (keyof SettlementDetailsFields)[]).map(key => getSettlementFieldError(key, fields[key]));
    setTouched({ bankId: true, accountNumber: true, accountName: true });
    if (errors.some(Boolean) || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const result = await repository.save({ roomId, ...fields });
      const saved: SettlementDetails = {
        version: 1,
        roomId,
        bankId: fields.bankId.trim(),
        accountNumber: fields.accountNumber.trim(),
        accountName: fields.accountName.trim(),
        updatedAtUtcMs: null,
        expiresAtUtcMs: result.expiresAtUtcMs,
      };
      setDetails(saved);
      onSaved(saved);
    } catch (error) {
      setSaveError(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return {
    fields, details, loading, saving, loadError, saveError, touched,
    banks, bankLoading, bankError, bankPickerVisible, bankSearch, selectedBank, manualBankEntry,
    setBankPickerVisible, setBankSearch, setSelectedBank, setManualBankEntry, setTouched,
    isDirty, canContinueWithoutSaving, loadBanks, change, submit,
  };
}
