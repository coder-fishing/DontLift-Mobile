import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { BottomTabInset, Colors } from "../constants/theme";
import type {
  SettlementDetails,
  SettlementDetailsError,
  SettlementDetailsInput,
} from "../features/settlement/settlement-details-repository";
import type { BankOption } from "../features/settlement/bank-directory";

type Repository = {
  read: (roomId: string) => Promise<SettlementDetails | null>;
  save: (
    input: SettlementDetailsInput,
  ) => Promise<{ version: 1; roomId: string; expiresAtUtcMs: number }>;
};

type Props = {
  roomId: string;
  mode: "host" | "member";
  repository: Repository;
  onSaved: (details: SettlementDetails) => void;
  onBack: () => void;
  bankDirectory: { list: () => Promise<BankOption[]> };
};

type Fields = Pick<
  SettlementDetailsInput,
  "bankId" | "accountNumber" | "accountName"
>;
const EMPTY_FIELDS: Fields = { bankId: "", accountNumber: "", accountName: "" };

function BankLogo({ bank }: { bank: BankOption }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [bank.bin, bank.logo]);
  return (
    <View style={styles.bankLogo}>
      {bank.logo && !failed ? (
        <Image
          source={{ uri: bank.logo }}
          contentFit="contain"
          transition={120}
          style={styles.bankLogoImage}
          accessibilityIgnoresInvertColors
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.bankLogoFallback}>
          {bank.shortName.slice(0, 3).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function fieldError(key: keyof Fields, value: string): string | undefined {
  const trimmed = value.trim();
  const limit = key === "bankId" ? 32 : key === "accountNumber" ? 64 : 100;
  if (!trimmed) return "This field is required.";
  if (trimmed.length > limit) return `Use ${limit} characters or fewer.`;
  return undefined;
}

function saveErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as SettlementDetailsError).code
      : undefined;
  if (code === "permission-denied")
    return "Only the Host can save details after scores are finalized.";
  if (code === "failed-precondition")
    return "Settlement details unlock after the room scores are finalized.";
  if (code === "invalid-argument") return "Check the fields and try again.";
  if (code === "unauthenticated")
    return "Your sign-in expired. Sign in again and retry.";
  return "Could not save to Firebase. Reconnect and retry; no offline write was queued.";
}

export function SettlementDetailsScreen({
  roomId,
  mode,
  repository,
  onSaved,
  onBack,
  bankDirectory,
}: Props) {
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [details, setDetails] = useState<SettlementDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [touched, setTouched] = useState<
    Partial<Record<keyof Fields, boolean>>
  >({});
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [manualBankEntry, setManualBankEntry] = useState(false);

  useEffect(() => {
    if (!fields.bankId) {
      setSelectedBank(null);
      return;
    }
    const match = banks.find((bank) => bank.bin === fields.bankId);
    setSelectedBank(match ?? null);
  }, [banks, fields.bankId]);

  const loadBanks = async () => {
    setBankLoading(true);
    setBankError(false);
    try {
      setBanks(await bankDirectory.list());
    } catch {
      setBankError(true);
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void repository
      .read(roomId)
      .then((value) => {
        if (!active) return;
        setDetails(value);
        if (mode === "host" && value) {
          setFields({
            bankId: value.bankId,
            accountNumber: value.accountNumber,
            accountName: value.accountName,
          });
          setSelectedBank(null);
        }
        if (value && /^\d{6}$/.test(value.bankId)) void loadBanks();
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, repository, roomId]);

  const change = (key: keyof Fields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveError(undefined);
  };
  const submit = async () => {
    const errors = (Object.keys(fields) as (keyof Fields)[]).map((key) =>
      fieldError(key, fields[key]),
    );
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

  const field = (
    key: keyof Fields,
    label: string,
    hint: string,
    keyboardType: "default" | "number-pad" = "default",
  ) => {
    const error = touched[key] ? fieldError(key, fields[key]) : undefined;
    return (
      <View style={styles.field} key={key}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          editable={mode === "host" && !saving}
          value={
            key === "bankId" && selectedBank ? selectedBank.name : fields[key]
          }
          onChangeText={(value) => change(key, value)}
          onBlur={() => setTouched((current) => ({ ...current, [key]: true }))}
          placeholder={hint}
          placeholderTextColor={Colors.light.textSecondary}
          keyboardType={keyboardType}
          autoCapitalize={key === "accountName" ? "words" : "none"}
          autoCorrect={false}
          maxLength={key === "bankId" ? 32 : key === "accountNumber" ? 64 : 100}
          returnKeyType={key === "accountName" ? "done" : "next"}
          style={[
            styles.input,
            mode === "member" && styles.readOnlyInput,
            error && styles.inputError,
          ]}
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to group summary"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Group summary</Text>
        </Pressable>
        <GlassCard style={styles.card}>
          <Text style={styles.eyebrow}>ROOM SETTLEMENT</Text>
          <Text style={styles.title}>
            {mode === "host" ? "Payment details" : "Host payment details"}
          </Text>
          <Text style={styles.body}>
            {mode === "host"
              ? "Members in this room can view these details for 30 days after the session ends."
              : "These details are available only to members of this room and expire 30 days after the session ends."}
          </Text>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.light.primary} />
              <Text style={styles.body}>Loading from Firebase…</Text>
            </View>
          ) : loadError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              Could not load payment details. Check your connection and return
              to retry.
            </Text>
          ) : mode === "member" && !details ? (
            <Text style={styles.empty}>
              The Host has not entered payment details yet.
            </Text>
          ) : (
            <>
              {mode === "host" ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Bank</Text>
                  {!manualBankEntry ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        selectedBank
                          ? `Selected bank: ${selectedBank.name}, BIN ${selectedBank.bin}`
                          : "Choose bank"
                      }
                      accessibilityState={{ expanded: bankPickerVisible }}
                      onPress={() => {
                        setBankPickerVisible(true);
                        setBankSearch("");
                        if (!banks.length && !bankLoading) void loadBanks();
                      }}
                      style={styles.bankSelector}
                    >
                      {selectedBank ? (
                        <BankLogo bank={selectedBank} />
                      ) : (
                        <View style={styles.bankLogoPlaceholder}>
                          <Text style={styles.bankLogoFallback}>BANK</Text>
                        </View>
                      )}
                      <View style={styles.bankSelectorText}>
                        <Text
                          numberOfLines={2}
                          ellipsizeMode="tail"
                          style={
                            selectedBank ? styles.bankValue : styles.placeholder
                          }
                        >
                          {selectedBank?.name ??
                            (fields.bankId || "Choose a bank from the list")}
                        </Text>
                        {selectedBank ? (
                          <Text style={styles.bankMeta}>
                            BIN {selectedBank.bin}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={styles.bankChevron}
                      >
                        ›
                      </Text>
                    </Pressable>
                  ) : (
                    field(
                      "bankId",
                      "Bank name or identifier",
                      "Enter a bank name or identifier",
                    )
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      manualBankEntry
                        ? "Choose from bank list"
                        : "Enter bank manually"
                    }
                    onPress={() => {
                      setManualBankEntry((value) => !value);
                      setSelectedBank(null);
                    }}
                    style={styles.manualToggle}
                  >
                    <Text style={styles.manualToggleText}>
                      {manualBankEntry
                        ? "Choose from bank list"
                        : "Enter bank manually"}
                    </Text>
                  </Pressable>
                  {bankLoading ? (
                    <View style={styles.loading}>
                      <ActivityIndicator color={Colors.light.primary} />
                      <Text style={styles.body}>Loading banks…</Text>
                    </View>
                  ) : null}
                  {bankError ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        void loadBanks();
                      }}
                    >
                      <Text style={styles.error}>
                        Could not load banks. Tap to retry; manual entry is
                        still available.
                      </Text>
                    </Pressable>
                  ) : null}
                  <Modal
                    visible={bankPickerVisible}
                    animationType="slide"
                    onRequestClose={() => setBankPickerVisible(false)}
                  >
                    <View style={styles.modal}>
                      <Text style={styles.eyebrow}>ROOM SETTLEMENT</Text>
                      <Text style={styles.title}>Choose a bank</Text>
                      <TextInput
                        accessibilityLabel="Search banks"
                        value={bankSearch}
                        onChangeText={setBankSearch}
                        placeholder="Search by bank name or code"
                        placeholderTextColor={Colors.light.textSecondary}
                        style={styles.input}
                      />
                      <FlatList
                        data={banks.filter((bank) =>
                          `${bank.name} ${bank.shortName} ${bank.code} ${bank.bin}`
                            .toLocaleLowerCase()
                            .includes(bankSearch.trim().toLocaleLowerCase()),
                        )}
                        keyExtractor={(item) => item.bin}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${item.name}, BIN ${item.bin}`}
                            accessibilityState={{
                              selected: selectedBank?.bin === item.bin,
                            }}
                            onPress={() => {
                              setManualBankEntry(false);
                              change("bankId", item.bin);
                              setBankPickerVisible(false);
                            }}
                            style={styles.bankRow}
                          >
                            <BankLogo bank={item} />
                            <View style={styles.bankRowText}>
                              <Text
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                style={styles.bankValue}
                              >
                                {item.name}
                              </Text>
                              <Text style={styles.bankMeta}>
                                {/* {item.shortName} · BIN {item.bin} */}
                              </Text>
                            </View>
                          </Pressable>
                        )}
                        ListEmptyComponent={
                          <Text style={styles.empty}>
                            {bankLoading
                              ? "Loading banks…"
                              : "No matching banks. You can enter a bank identifier manually."}
                          </Text>
                        }
                      />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setBankPickerVisible(false)}
                        style={styles.closePicker}
                      >
                        <Text style={styles.backText}>Close</Text>
                      </Pressable>
                    </View>
                  </Modal>
                </View>
              ) : (
                field("bankId", "Bank", "Bank name or identifier")
              )}
              {field(
                "accountNumber",
                "Account number",
                "Enter the recipient account number",
                "number-pad",
              )}
              {field(
                "accountName",
                "Account holder name",
                "Enter the name shown on the bank account",
              )}
              {details ? (
                <Text style={styles.expiry}>
                  Available until{" "}
                  {new Date(details.expiresAtUtcMs).toLocaleDateString()}
                </Text>
              ) : null}
              {mode === "host" ? (
                <>
                  <Text style={styles.note}>
                    DontLift does not hold or move money. These details are
                    saved only on this room.
                  </Text>
                  {saveError ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {saveError}
                    </Text>
                  ) : null}
                  <PrimaryButton
                    title={
                      saving
                        ? "Saving…"
                        : details
                          ? "Update payment details"
                          : "Save payment details"
                    }
                    disabled={saving || loading}
                    accessibilityLabel={
                      saving ? "Saving payment details" : "Save payment details"
                    }
                    onPress={() => {
                      void submit();
                    }}
                    style={styles.saveButton}
                  />
                </>
              ) : null}
            </>
          )}
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: 12, paddingBottom: BottomTabInset + 32 },
  backButton: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
  },
  backText: { color: Colors.light.primary, fontSize: 14, fontWeight: "700" },
  card: { gap: 12, padding: 16, borderRadius: 24 },
  eyebrow: {
    color: Colors.light.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: Colors.light.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  body: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20 },
  field: { gap: 7 },
  label: { color: Colors.light.text, fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.inputSurface,
    color: Colors.light.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  readOnlyInput: { opacity: 0.88 },
  inputError: { borderColor: Colors.light.error },
  error: { color: Colors.light.error, fontSize: 13, lineHeight: 18 },
  empty: {
    paddingVertical: 16,
    color: Colors.light.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  loading: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  expiry: { color: Colors.light.textSecondary, fontSize: 13 },
  note: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 18 },
  saveButton: { marginTop: 4 },
  placeholder: {
    color: Colors.light.textSecondary,
    fontSize: 15,
    lineHeight: 20,
  },
  bankValue: {
    color: Colors.light.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  bankMeta: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 16 },
  modal: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === "android" ? 32 : 56,
    gap: 12,
    backgroundColor: Colors.light.background,
  },
  bankRow: {
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  bankSelector: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    backgroundColor: Colors.light.inputSurface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bankSelectorText: { flex: 1, minWidth: 0, gap: 3 },
  bankChevron: {
    color: Colors.light.textSecondary,
    fontSize: 26,
    lineHeight: 30,
    paddingLeft: 4,
  },
  bankLogo: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bankLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: "center",
    justifyContent: "center",
  },
  bankLogoImage: { width: 40, height: 40 },
  bankLogoFallback: {
    color: Colors.light.primary,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  bankRowText: { flex: 1, gap: 4 },
  closePicker: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  manualToggle: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 2,
  },
  manualToggleText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
