import assert from "node:assert/strict";
import bwipjs from "@bwip-js/node";
import { PrismaClient } from "@prisma/client";
import { decryptLoyaltyPayload, encryptLoyaltyPayload, payloadLast4 } from "../lib/loyalty-crypto";
import { bwipBarcodeIds } from "../lib/loyalty-barcode";

const prisma = new PrismaClient();

async function main() {
  const secretPayload = "LOYALTY-USER-A-998877665544";
  const [userA, userB] = await Promise.all([
    prisma.user.create({ data: { email: "wallet-a@example.test", name: "Wallet A" } }),
    prisma.user.create({ data: { email: "wallet-b@example.test", name: "Wallet B" } }),
  ]);

  const encryptedPayload = encryptLoyaltyPayload(secretPayload);
  assert.notEqual(encryptedPayload, secretPayload);
  assert.equal(encryptedPayload.includes(secretPayload), false);
  assert.equal(decryptLoyaltyPayload(encryptedPayload), secretPayload);

  const card = await prisma.loyaltyCard.create({
    data: {
      userId: userA.id,
      label: "Test loyalty card",
      barcodeFormat: "CODE_128",
      encryptedPayload,
      payloadLast4: payloadLast4(secretPayload),
      favorite: true,
    },
  });

  const stored = await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(stored.encryptedPayload.includes(secretPayload), false);
  assert.equal(stored.payloadLast4, "5544");
  assert.equal(decryptLoyaltyPayload(stored.encryptedPayload), secretPayload);

  const ownerView = await prisma.loyaltyCard.findFirst({ where: { id: card.id, userId: userA.id } });
  const foreignView = await prisma.loyaltyCard.findFirst({ where: { id: card.id, userId: userB.id } });
  assert.ok(ownerView);
  assert.equal(foreignView, null);

  const svg = bwipjs.toSVG({ bcid: bwipBarcodeIds[stored.barcodeFormat], text: secretPayload, scale: 2, height: 12 });
  assert.match(svg, /<svg\b/);

  await prisma.loyaltyEvent.create({ data: { cardId: card.id, type: "EARN", amount: 25, description: "Future marketplace earn path schema proof" } });
  assert.equal(await prisma.loyaltyEvent.count({ where: { cardId: card.id } }), 1);

  console.log("Loyalty wallet E2E verified: encrypted-at-rest, owner isolation, barcode rendering, future ledger schema.");
}

main().finally(() => prisma.$disconnect());
