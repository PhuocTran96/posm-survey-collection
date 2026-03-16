import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = process.env.NEXTAUTH_SECRET || 'posm-survey-secret-key-2024';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('next-auth.session-token')?.value;

    if (!token) {
      return NextResponse.json({ user: null, authenticated: false });
    }

    const secret = new TextEncoder().encode(SECRET_KEY);
    const { payload } = await jwtVerify(token, secret);

    // Check if token is expired
    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return NextResponse.json({ user: null, authenticated: false });
      }
    }

    return NextResponse.json({
      user: {
        id: payload.id as string,
        userid: payload.userid as string,
        username: payload.username as string,
        loginid: payload.loginid as string,
        role: payload.role as string,
        leader: payload.leader as string | null,
        isSuperAdmin: payload.isSuperAdmin as boolean,
      },
      authenticated: true,
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null, authenticated: false });
  }
}
