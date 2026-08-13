import type { LoyaltyBarcodeFormat } from "@prisma/client";

export const loyaltyBarcodeLabels: Record<LoyaltyBarcodeFormat, string> = {
  QR_CODE: "QR Code",
  AZTEC: "Aztec",
  DATA_MATRIX: "Data Matrix",
  PDF_417: "PDF417",
  CODE_128: "Code 128",
  CODE_39: "Code 39",
  EAN_13: "EAN-13",
  EAN_8: "EAN-8",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  CODABAR: "Codabar",
  ITF: "ITF",
};

export const bwipBarcodeIds: Record<LoyaltyBarcodeFormat, string> = {
  QR_CODE: "qrcode",
  AZTEC: "azteccode",
  DATA_MATRIX: "datamatrix",
  PDF_417: "pdf417",
  CODE_128: "code128",
  CODE_39: "code39",
  EAN_13: "ean13",
  EAN_8: "ean8",
  UPC_A: "upca",
  UPC_E: "upce",
  CODABAR: "rationalizedCodabar",
  ITF: "interleaved2of5",
};

export function isLoyaltyBarcodeFormat(value: string): value is LoyaltyBarcodeFormat {
  return Object.prototype.hasOwnProperty.call(loyaltyBarcodeLabels, value);
}
