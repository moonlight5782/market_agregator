"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";
import { encryptLoyaltyPayload, payloadLast4 } from "../../lib/loyalty-crypto";
import { isLoyaltyBarcodeFormat } from "../../lib/loyalty-barcode";

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

export async function addLoyaltyCard(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const label = text(formData, "label", 120);
  const cardholderName = text(formData, "cardholderName", 120) || null;
  const payload = text(formData, "payload", 4096);
  const format = text(formData, "barcodeFormat", 32);
  const notes = text(formData, "notes", 500) || null;
  const color = text(formData, "color", 16) || null;
  const favorite = formData.get("favorite") === "on";
  if (!label || !payload || !isLoyaltyBarcodeFormat(format)) throw new Error("Invalid loyalty card data.");

  await prisma.loyaltyCard.create({
    data: {
      userId: session.user.id,
      label,
      cardholderName,
      barcodeFormat: format,
      encryptedPayload: encryptLoyaltyPayload(payload),
      payloadLast4: payloadLast4(payload),
      notes,
      color,
      favorite,
    },
  });
  revalidatePath("/account");
}

export async function deleteLoyaltyCard(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const id = text(formData, "id", 64);
  if (!id) return;
  await prisma.loyaltyCard.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/account");
}
