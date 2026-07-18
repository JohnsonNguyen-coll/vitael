import { NextRequest, NextResponse } from "next/server";

/**
 * The marketing site lives on the apex domain while the product lives on app.<domain>.
 * Both hosts can point to the same Next.js deployment; only the app host's root is
 * redirected into the existing product routes.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";

  if (hostname.startsWith("app.") && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/lend", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
