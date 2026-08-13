"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { authConfigured } from "../../lib/auth-config";
import { prisma } from "../../lib/prisma";
import { encryptLoyaltyPayload, payloadLast4 } from "../../lib/loyalty-crypto";
import { isLoyaltyBarcodeFormat } from "../../lib/loyalty-barcode";

function text(formData: FormData, key: string, max: number) { return String(formData.get(key) ?? "").trim().slice(0, max); }
async function requireUser() {
  if (!authConfigured) throw new Error("OAuth is not configured.");
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

export async function addLoyaltyCard(formData: FormData) {
  const userId = await requireUser();
  const label = text(formData, "label", 120);
  const cardholderName = text(formData, "cardholderName", 120) || null;
  const payload = text(formData, "payload", 4096);
  const format = text(formData, "barcodeFormat", 32);
  const notes = text(formData, "notes", 500) || null;
  const color = text(formData, "color", 16) || null;
  const favorite = formData.get("favorite") === "on";
  if (!label || !payload || !isLoyaltyBarcodeFormat(format)) throw new Error("Invalid loyalty card data.");
  await prisma.loyaltyCard.create({ data: { userId, label, cardholderName, barcodeFormat: format, encryptedPayload: encryptLoyaltyPayload(payload), payloadLast4: payloadLast4(payload), notes, color, favorite } });
  revalidatePath("/account");
}

export async function deleteLoyaltyCard(formData: FormData) {
  const userId = await requireUser();
  const id = text(formData, "id", 64);
  if (!id) return;
  await prisma.loyaltyCard.deleteMany({ where: { id, userId } });
  revalidatePath("/account");
}
