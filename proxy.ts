import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-session";

// Demo gate for /admin/*: a session cookie set by /admin/login, password from ADMIN_PASSWORD.
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse("Admin is not configured.", { status: 503 });
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (isAdminSession(request.cookies.get(ADMIN_COOKIE)?.value, password)) {
    return NextResponse.next();
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return new NextResponse("Authentication required.", { status: 401 });
}

export const config = {
  matcher: "/admin/:path*",
};
