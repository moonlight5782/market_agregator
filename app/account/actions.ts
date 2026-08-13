"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { authConfigured } from "../../lib/auth-config";
import { prisma } from "../../lib/prisma";
import { encryptLoyaltyPayload, payloadLast4 } from "../../lib/loyalty-crypto";
import { isLoyaltyBarcodeFormat } from "../../lib/loyalty-barcode";

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

async function requireUser() {
  if (!authConfigured) throw new Error("OAuth is not configured.");
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

async function resolveProgram(storeId: string | null) {
  if (!storeId) return null;
  const store = await prisma.store.findFirst({
    where: { id: storeId, active: true },
    select: { id: true, name: true, domain: true },
  });
  if (!store) throw new Error("Unknown loyalty-card store.");

  return prisma.loyaltyProgram.upsert({
    where: { storeId_externalProgramId: { storeId: store.id, externalProgramId: "default" } },
    update: { name: `${store.name} loyalty`, issuer: store.name, websiteUrl: store.domain, active: true },
    create: {
      storeId: store.id,
      externalProgramId: "default",
      name: `${store.name} loyalty`,
      issuer: store.name,
      websiteUrl: store.domain,
    },
  });
}

export async function addLoyaltyCard(formData: FormData) {
  const userId = await requireUser();
  const label = text(formData, "label", 120);
  const cardholderName = text(formData, "cardholderName", 120) || null;
  const payload = text(formData, "payload", 4096);
  const format = text(formData, "barcodeFormat", 32);
  const notes = text(formData, "notes", 500) || null;
  const color = text(formData, "color", 16) || null;
  const storeId = text(formData, "storeId", 64) || null;
  const favorite = formData.get("favorite") === "on";
  if (!label || !payload || !isLoyaltyBarcodeFormat(format)) throw new Error("Invalid loyalty card data.");

  const program = await resolveProgram(storeId);
  await prisma.loyaltyCard.create({
    data: {
      userId,
      programId: program?.id ?? null,
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
  const userId = await requireUser();
  const id = text(formData, "id", 64);
  if (!id) return;
  await prisma.loyaltyCard.deleteMany({ where: { id, userId } });
  revalidatePath("/account");
}
