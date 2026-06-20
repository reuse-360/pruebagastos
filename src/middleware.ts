import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const cookie = request.cookies.get("gastos_auth")?.value;
  if (cookie && cookie === process.env.AUTH_PASSWORD) return NextResponse.next();

  const url = new URL("/login", request.url);
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next|favicon|icons|manifest\\.json|serwist).*)"],
};
