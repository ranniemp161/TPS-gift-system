import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "tps_admin";

export function adminSessionToken(password: string): string {
  return createHmac("sha256", password).update("tps-admin-session").digest("hex");
}

export function isAdminSession(
  cookieValue: string | undefined,
  password: string,
): boolean {
  if (!cookieValue) return false;
  const expected = Buffer.from(adminSessionToken(password));
  const actual = Buffer.from(cookieValue);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
