import bwipjs from "@bwip-js/node";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";
import { decryptLoyaltyPayload } from "../../../../../lib/loyalty-crypto";
import { bwipBarcodeIds } from "../../../../../lib/loyalty-barcode";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const card = await prisma.loyaltyCard.findFirst({ where: { id, userId: session.user.id, status: "ACTIVE" } });
  if (!card) return new Response("Not found", { status: 404 });
  try {
    const payload = decryptLoyaltyPayload(card.encryptedPayload);
    const twoDimensional = ["QR_CODE", "AZTEC", "DATA_MATRIX", "PDF_417"].includes(card.barcodeFormat);
    const svg = bwipjs.toSVG({ bcid: bwipBarcodeIds[card.barcodeFormat], text: payload, scale: 3, height: twoDimensional ? 22 : 14, includetext: !twoDimensional, textxalign: "center" });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Invalid barcode data", { status: 422 });
  }
}
