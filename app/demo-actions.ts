"use server";

import { cookies } from "next/headers";
import { DEMO_DATE_COOKIE } from "@/lib/demo-clock";
import { isIsoDate } from "@/lib/fund-rules";

export type DemoDateState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function setDemoDate(
  _prevState: DemoDateState,
  formData: FormData,
): Promise<DemoDateState> {
  const raw = formData.get("demoDate");
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!isIsoDate(value)) {
    return { status: "error", message: "Enter a real date." };
  }

  (await cookies()).set(DEMO_DATE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return { status: "ok" };
}

export async function clearDemoDate(): Promise<void> {
  (await cookies()).delete(DEMO_DATE_COOKIE);
}
