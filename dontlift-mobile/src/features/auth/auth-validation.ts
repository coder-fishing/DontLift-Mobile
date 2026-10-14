export interface RegistrationInput {
  displayName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export type RegistrationField = keyof RegistrationInput;
export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

export function validateRegistration(input: RegistrationInput): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  const displayName = input.displayName.trim();
  const email = input.email.trim();

  if (Array.from(displayName).length < 1 || Array.from(displayName).length > 40) {
    errors.displayName = 'Enter a name between 1 and 40 characters.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!input.password) {
    errors.password = 'Enter a password.';
  }
  if (input.password !== input.passwordConfirmation) {
    errors.passwordConfirmation = 'Passwords do not match.';
  }

  return errors;
}
