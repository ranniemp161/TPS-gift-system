import { cookies } from "next/headers";
import { isIsoDate, todayIsoDate } from "@/lib/fund-rules";

export const DEMO_DATE_COOKIE = "tps_demo_today";

export async function getDemoDate(): Promise<string | null> {
  const value = (await cookies()).get(DEMO_DATE_COOKIE)?.value;
  return value && isIsoDate(value) ? value : null;
}

export async function currentIsoDate(): Promise<string> {
  return (await getDemoDate()) ?? todayIsoDate();
}
