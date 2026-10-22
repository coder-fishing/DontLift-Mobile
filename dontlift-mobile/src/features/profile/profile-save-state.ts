export function canSubmitProfileSave(input: {
  dirty: boolean;
  needsLocalRepair: boolean;
  saving: boolean;
  online: boolean | null;
}): boolean {
  return input.online === true && !input.saving && (input.dirty || input.needsLocalRepair);
}
