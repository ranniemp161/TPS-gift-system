"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  adminSessionToken,
  isAdminSession,
} from "@/lib/admin-session";

export type AdminLoginState = { status: "idle" } | { status: "error"; message: string };

export async function signInAdmin(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return { status: "error", message: "Admin is not configured." };
  }

  const submitted = formData.get("password");
  if (
    typeof submitted !== "string" ||
    !isAdminSession(adminSessionToken(submitted), password)
  ) {
    return { status: "error", message: "Incorrect password." };
  }

  (await cookies()).set(ADMIN_COOKIE, adminSessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/admin/funds");
}

export async function signOutAdmin(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}
