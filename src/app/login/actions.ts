"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/ratelimit";

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Password is required."),
});

// Dummy hash used when the email is not found so bcrypt.compare always runs,
// making it harder to enumerate valid accounts via response timing.
const DUMMY_HASH =
  "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

export async function login(_prev: unknown, formData: FormData) {
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawPassword = String(formData.get("password") ?? "");

  const parsed = LoginSchema.safeParse({ email: rawEmail, password: rawPassword });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password } = parsed.data;

  // Rate-limit by IP and by email to cover both attack vectors.
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : "unknown").trim();
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${email}`;

  if (isRateLimited(ipKey) || isRateLimited(emailKey)) {
    return { error: "Too many failed attempts. Please wait 15 minutes and try again." };
  }

  let staff: { id: string; name: string; role: "OWNER" | "OPERATOR"; passwordHash: string } | null;
  try {
    staff = await db.staff.findUnique({ where: { email } });
  } catch (e) {
    console.error("[login] db error", e);
    return { error: "Something went wrong. Please try again." };
  }

  // Always run bcrypt compare to prevent user-enumeration via timing.
  const hashToCheck = staff?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!staff || !passwordOk) {
    recordFailure(ipKey);
    recordFailure(emailKey);
    return { error: "Wrong email or password." };
  }

  // Successful login — clear failure counters.
  clearFailures(ipKey);
  clearFailures(emailKey);

  try {
    await createSession({ staffId: staff.id, name: staff.name, role: staff.role });
  } catch (e) {
    console.error("[login] createSession error", e);
    return { error: "Failed to create session. Please try again." };
  }

  redirect("/");
}
