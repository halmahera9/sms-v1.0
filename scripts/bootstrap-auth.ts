import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tidak tersedia.");
  }

  const username = process.env.AUTH_BOOTSTRAP_USERNAME?.trim();
  const password = process.env.AUTH_BOOTSTRAP_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Set AUTH_BOOTSTRAP_USERNAME dan AUTH_BOOTSTRAP_PASSWORD terlebih dahulu.",
    );
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: crypto.randomUUID(),
          code: "SMPN99JKT",
          name: "SMP Negeri 99 Jakarta",
        },
      });

      const actor = await tx.userActor.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          username,
          email: username,
          fullName: "Administrator",
          role: "ADMIN",
          status: "ACTIVE",
          passwordHash: hashPassword(password),
        },
        select: {
          username: true,
          role: true,
          fullName: true,
          tenantId: true,
        },
      });

      return { tenant, actor };
    });

    console.log(`Tenant berhasil dibuat: ${result.tenant.name}`);
    console.log(
      `Admin berhasil dibuat: ${result.actor.username} (${result.actor.role})`,
    );
    console.log(`Tenant ID: ${result.actor.tenantId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
