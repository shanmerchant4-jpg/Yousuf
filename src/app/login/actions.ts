"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter email and password." };
  }

  const staff = await db.staff.findUnique({ where: { email } });
  if (!staff || !(await verifyPassword(password, staff.passwordHash))) {
    return { error: "Wrong email or password." };
  }

  await createSession({ staffId: staff.id, name: staff.name, role: staff.role });
  redirect("/");
}
