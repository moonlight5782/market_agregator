export const LoyaltyBarcodeFormat = {
  CODE_128: "CODE_128",
  EAN_13: "EAN_13",
  QR_CODE: "QR_CODE",
  PDF_417: "PDF_417",
  DATA_MATRIX: "DATA_MATRIX",
} as const;

export type LoyaltyBarcodeFormat = (typeof LoyaltyBarcodeFormat)[keyof typeof LoyaltyBarcodeFormat];
