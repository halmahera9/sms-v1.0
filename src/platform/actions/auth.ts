"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { adminPrisma } from "@/platform/db/prisma";
import { createSessionToken } from "@/platform/auth/session";

const SESSION_COOKIE_NAME = "banyubiru_session";
const SESSION_MAX_AGE = 60 * 60 * 24;

function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, salt, encodedDigest] = storedHash.split("$");

  if (scheme !== "scrypt" || !salt || !encodedDigest) {
    return false;
  }

  try {
    const expected = Buffer.from(encodedDigest, "hex");
    const actual = scryptSync(password, salt, expected.length);

    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${digest}`;
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return {
      ok: false,
      error: "Username dan password wajib diisi.",
    };
  }

  const actors = await adminPrisma.userActor.findMany({
    where: {
      username,
      status: "ACTIVE",
    },
    take: 10,
  });

  const actor = actors.find(
    (candidate) =>
      candidate.passwordHash &&
      verifyPassword(password, candidate.passwordHash),
  );

  if (!actor) {
    return {
      ok: false,
      error: "Username atau password tidak valid.",
    };
  }

  const sessionToken = createSessionToken({
    actorId: actor.id,
    tenantId: actor.tenantId,
    username: actor.username,
    role: actor.role,
    status: actor.status,
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/app");
}

export async function logoutAction() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  redirect("/login");
}

