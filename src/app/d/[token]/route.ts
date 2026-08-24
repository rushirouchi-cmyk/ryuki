import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handleQrScan } from "@/lib/domain/candidates/service";
import { CANDIDATE_COOKIE } from "@/lib/auth/session";

/**
 * QR landing endpoint. The token identifies the sales rep x location x shift,
 * never the candidate, and carries no personal data.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const db = await getDb();
  const existing = request.cookies.get(CANDIDATE_COOKIE)?.value ?? null;

  const outcome = await handleQrScan(db, token, existing);
  if (!outcome) {
    return NextResponse.redirect(new URL("/diagnosis/invalid", request.url));
  }

  const response = NextResponse.redirect(
    new URL(`/diagnosis/${outcome.publicToken}`, request.url),
  );
  response.cookies.set(CANDIDATE_COOKIE, outcome.publicToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
