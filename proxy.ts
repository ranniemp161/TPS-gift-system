import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REALM = 'Basic realm="TPS admin", charset="UTF-8"';

function unauthorized(status: 401 | 503, message: string) {
  return new NextResponse(message, {
    status,
    headers: status === 401 ? { "WWW-Authenticate": REALM } : undefined,
  });
}

// Demo gate for /admin/*: HTTP Basic auth, any username, password from ADMIN_PASSWORD.
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return unauthorized(503, "Admin is not configured.");
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice("Basic ".length));
      const separator = decoded.indexOf(":");
      if (separator !== -1 && decoded.slice(separator + 1) === password) {
        return NextResponse.next();
      }
    } catch {
      // Malformed credentials fall through to the challenge below.
    }
  }

  return unauthorized(401, "Authentication required.");
}

export const config = {
  matcher: "/admin/:path*",
};
