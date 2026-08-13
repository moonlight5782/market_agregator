import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const DEFAULT_KEY_ID = "v1";

function activeKeyId() {
  return process.env.LOYALTY_CARD_KEY_ID?.trim() || DEFAULT_KEY_ID;
}

function envNameForKey(keyId: string) {
  return `LOYALTY_CARD_ENCRYPTION_KEY_${keyId.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
}

function secretForKey(keyId: string) {
  const versioned = process.env[envNameForKey(keyId)];
  if (versioned) return versioned;

  if (keyId === DEFAULT_KEY_ID) {
    const dedicated = process.env.LOYALTY_CARD_ENCRYPTION_KEY;
    if (dedicated) return dedicated;
    if (process.env.NODE_ENV !== "production" && process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  }

  throw new Error(
    `Missing ${envNameForKey(keyId)} or LOYALTY_CARD_ENCRYPTION_KEY. ` +
      "Production must use a dedicated loyalty-card encryption key, not AUTH_SECRET.",
  );
}

function keyFromSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function encryptionKey(keyId: string) {
  return keyFromSecret(secretForKey(keyId));
}

function legacySecrets() {
  return [
    process.env[envNameForKey(DEFAULT_KEY_ID)],
    process.env.LOYALTY_CARD_ENCRYPTION_KEY,
    process.env.AUTH_SECRET,
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

function decryptWithSecret(ivEncoded: string, tagEncoded: string, ciphertextEncoded: string, secret: string) {
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptLoyaltyPayload(value: string) {
  const keyId = activeKeyId();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyId), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${keyId}.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptLoyaltyPayload(payload: string) {
  const parts = payload.split(".");

  if (parts[0] === "v1") {
    const [, ivEncoded, tagEncoded, ciphertextEncoded] = parts;
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Unsupported loyalty payload format.");

    const candidates = legacySecrets();
    if (candidates.length === 0) throw new Error("No legacy loyalty encryption key is configured.");
    for (const secret of candidates) {
      try {
        return decryptWithSecret(ivEncoded, tagEncoded, ciphertextEncoded, secret);
      } catch {
        // v1 had no key id, so migration may require trying the previous key.
      }
    }
    throw new Error("Unable to decrypt legacy loyalty payload with configured keys.");
  }

  if (parts[0] === "v2") {
    const [, keyId, ivEncoded, tagEncoded, ciphertextEncoded] = parts;
    if (!keyId || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Unsupported loyalty payload format.");
    return decryptWithSecret(ivEncoded, tagEncoded, ciphertextEncoded, secretForKey(keyId));
  }

  throw new Error("Unsupported loyalty payload format.");
}

export function payloadLast4(value: string) {
  const normalized = value.trim();
  return normalized.length <= 4 ? normalized : normalized.slice(-4);
}
