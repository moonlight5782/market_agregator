import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const secret = process.env.LOYALTY_CARD_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("LOYALTY_CARD_ENCRYPTION_KEY or AUTH_SECRET must be configured before storing loyalty cards.");
  return createHash("sha256").update(secret).digest();
}

export function encryptLoyaltyPayload(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptLoyaltyPayload(payload: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split(".");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Unsupported loyalty payload format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}

export function payloadLast4(value: string) {
  const normalized = value.trim();
  return normalized.length <= 4 ? normalized : normalized.slice(-4);
}
