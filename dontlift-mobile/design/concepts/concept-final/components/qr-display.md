# Component: VietQR Display (`qr-display.md`)

- **Name:** VietQR Payment Display Card
- **Status:** Screen-specific (Appears in 1 screen: `08-member-bill-settlement.html`)
- **Screen References:**
  - `08-member-bill-settlement.html` (VietQR Direct Transfer Glass Slab)

---

## Visual Treatment
- **Container:** `frosted-glass` card (`p-5 flex flex-col items-center rounded-2xl`).
- **QR Image:** White rounded frame (`bg-white p-3 rounded-2xl shadow-sm`), center QR image (`w-48 h-48 object-contain`).
- **Bank Details:** Bank Name, Account Number, Account Owner Name in `JetBrains Mono` text, copy button (`content_copy`), and quick action CTAs ("Download QR", "Copy Account #").

---

## Props / Variants
- `bankName`: string (e.g. `'MBBank'`)
- `accountNumber`: string (e.g. `'0987654321'`)
- `accountOwner`: string (e.g. `'NGUYEN VAN A'`)
- `amountVnd`: number (e.g. `125.000 ₫`)
- `qrImageUrl`: string

---

## States
- **Default:** Clean QR code display with verified account information.
- **Copied Toast:** Triggers bottom toast notification ("Account number copied to clipboard").

---

## Accessibility Notes
- Includes text representation of bank, account number, and amount alongside QR image for screen readers.
