function unavailable(): never {
  throw new Error("Database access is unavailable in the hosted demo");
}

export const prisma = new Proxy({}, { get: unavailable }) as any;
