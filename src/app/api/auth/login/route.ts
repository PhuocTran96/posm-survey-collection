import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = process.env.NEXTAUTH_SECRET || 'posm-survey-secret-key-2024';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loginid, password } = body;

    console.log('Login attempt for:', loginid);

    if (!loginid || !password) {
      return NextResponse.json(
        { error: 'Missing credentials' },
        { status: 400 }
      );
    }

    // Find user
    const user = await db.user.findUnique({
      where: { loginid },
    });

    console.log('User found:', user ? user.loginid : 'not found');

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Create session token with proper expiration timestamp
    const secret = new TextEncoder().encode(SECRET_KEY);
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now
    
    const token = await new SignJWT({
      id: user.id,
      userid: user.userid,
      username: user.username,
      loginid: user.loginid,
      role: user.role,
      leader: user.leader,
      isSuperAdmin: user.isSuperAdmin,
      iat: Math.floor(Date.now() / 1000),
      exp: expiresAt,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret);

    // Set session cookie with proper attributes
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        loginid: user.loginid,
        role: user.role,
        leader: user.leader,
        isSuperAdmin: user.isSuperAdmin,
      },
    });

    // Set cookie directly on response
    response.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      secure: false, // Set to false for development
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    console.log('Login successful for:', user.username);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
