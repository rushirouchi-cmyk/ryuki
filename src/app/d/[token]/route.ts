import { NextResponse, type NextRequest } from 'next/server';
import { registerScan } from '@/server/services/candidates';
import { CANDIDATE_COOKIE } from '@/server/candidate-cookie';

/**
 * QR landing endpoint. Records the scan, locks first-valid attribution, drops
 * the anonymous candidate cookie and forwards to the diagnosis landing page.
 * The token itself carries no personal information.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const existingCandidateId = request.cookies.get(CANDIDATE_COOKIE)?.value ?? null;

  const result = await registerScan({
    qrToken: token,
    existingCandidateId,
    visitorParts: [request.headers.get('user-agent'), request.headers.get('accept-language')],
  });

  const url = new URL('/diagnosis', request.url);
  if (!result.qrValid) url.searchParams.set('qr', 'expired');

  const response = NextResponse.redirect(url);
  response.cookies.set(CANDIDATE_COOKIE, result.candidateId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
