import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { BottomTabInset, Colors } from "../constants/theme";
import { BankLogo, BankPickerModal } from "../features/settlement/components/BankPickerModal";
import { useSettlementDetailsForm, getSettlementFieldError, type SettlementDetailsFields, type SettlementDetailsRepositoryPort, type BankDirectoryPort } from "../features/settlement/use-settlement-details-form";
import type { SettlementDetails } from "../features/settlement/settlement-details-repository";

type Props = {
  roomId: string;
  mode: "host" | "member";
  repository: SettlementDetailsRepositoryPort;
  onSaved: (details: SettlementDetails) => void;
  onContinueToBill?: () => void;
  onBack: () => void;
  bankDirectory: BankDirectoryPort;
};

export function SettlementDetailsScreen({
  roomId,
  mode,
  repository,
  onSaved,
  onContinueToBill,
  onBack,
  bankDirectory,
}: Props) {
  const {
    fields, details, loading, saving, loadError, saveError, touched,
    banks, bankLoading, bankError, bankPickerVisible, bankSearch, selectedBank, manualBankEntry,
    setBankPickerVisible, setBankSearch, setSelectedBank, setManualBankEntry, setTouched,
    canContinueWithoutSaving, loadBanks, change, submit,
  } = useSettlementDetailsForm({
    roomId,
    mode,
    repository,
    bankDirectory,
    onSaved,
    hasContinueAction: Boolean(onContinueToBill),
  });

  const field = (
    key: keyof SettlementDetailsFields,
    label: string,
    hint: string,
    keyboardType: "default" | "number-pad" = "default",
  ) => {
    const error = touched[key] ? getSettlementFieldError(key, fields[key]) : undefined;
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
          <Ionicons
            name="chevron-back"
            size={18}
            color={Colors.light.primary}
            accessibilityElementsHidden
          />
          <Text style={styles.backText}>Group summary</Text>
        </Pressable>
        <GlassCard style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.eyebrow}>ROOM SETTLEMENT</Text>
            <Text style={styles.title}>
              {mode === "host" ? "Payment details" : "Host payment details"}
            </Text>
            <Text style={styles.body}>
              {mode === "host"
                ? "Add the account members will use to transfer their share."
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
                    {!manualBankEntry ? <Text style={styles.label}>Bank</Text> : null}
                    {!manualBankEntry ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          selectedBank
                            ? `Selected bank: ${selectedBank.shortName}, ${selectedBank.name}`
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
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={
                              selectedBank ? styles.bankValue : styles.placeholder
                            }
                          >
                            {selectedBank?.shortName ??
                              (fields.bankId || "Choose a bank from the list")}
                          </Text>
                          {selectedBank ? (
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={styles.bankMeta}
                            >
                              {selectedBank.name}
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
                      <View style={styles.manualBankField}>
                        {field(
                          "bankId",
                          "Bank name or identifier",
                          "Enter a bank name or identifier",
                        )}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Choose from bank list"
                          onPress={() => {
                            setBankPickerVisible(true);
                            setBankSearch("");
                            if (!banks.length && !bankLoading) void loadBanks();
                          }}
                          style={styles.inlineBankAction}
                        >
                          <Text style={styles.manualToggleText}>Choose from bank list</Text>
                        </Pressable>
                      </View>
                    )}
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
                    <BankPickerModal
                      visible={bankPickerVisible}
                      banks={banks}
                      loading={bankLoading}
                      selectedBank={selectedBank}
                      search={bankSearch}
                      onSearchChange={setBankSearch}
                      onSelect={item => {
                        setManualBankEntry(false);
                        change("bankId", item.bin);
                        setBankPickerVisible(false);
                      }}
                      onManualEntry={() => {
                        setManualBankEntry(true);
                        setSelectedBank(null);
                        change("bankId", "");
                        setBankPickerVisible(false);
                      }}
                      onClose={() => setBankPickerVisible(false)}
                    />
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
                {mode === "member" && details ? (
                  <Text style={styles.expiry}>
                    Available until {new Date(details.expiresAtUtcMs).toLocaleDateString()}
                  </Text>
                ) : null}
                {mode === "host" ? (
                  <>
                    <Text style={styles.note}>
                      {details
                        ? `Saved for this room until ${new Date(details.expiresAtUtcMs).toLocaleDateString()}. DontLift does not hold or move money.`
                        : "Available to room members for 30 days after the session ends. DontLift does not hold or move money."}
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
                          : canContinueWithoutSaving
                            ? "Continue to bill preview"
                            : "Save & continue to bill preview"
                      }
                      disabled={saving || loading}
                      accessibilityLabel={
                        saving
                          ? "Saving payment details"
                          : canContinueWithoutSaving
                            ? "Continue to bill preview"
                            : "Save payment details and continue to bill preview"
                      }
                      onPress={() => {
                        if (canContinueWithoutSaving) {
                          onContinueToBill?.();
                        } else {
                          void submit();
                        }
                      }}
                      style={styles.saveButton}
                    />
                  </>
                ) : null}
              </>
            )}
          </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.roomUtilitySurface,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  backText: { color: Colors.light.primary, fontSize: 14, fontWeight: "700" },
  card: { padding: 16, borderRadius: 24 },
  cardContent: { gap: 12 },
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
  note: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
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
  bankLogoFallback: {
    color: Colors.light.primary,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  bankRowText: { flex: 1, gap: 4 },
  manualBankField: { gap: 2 },
  inlineBankAction: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  manualPickerAction: {
    minHeight: 58,
    justifyContent: "center",
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.border,
  },
  manualPickerHint: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  closePicker: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  manualToggleText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
