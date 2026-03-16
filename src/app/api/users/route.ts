import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';

// GET - List all users with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { userid: { contains: search } },
        { username: { contains: search } },
        { loginid: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userid: true,
          username: true,
          loginid: true,
          role: true,
          leader: true,
          isActive: true,
          isSuperAdmin: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { assignedStores: true, surveyResponses: true },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userid, username, loginid, password, role, leader, isActive } = body;

    if (!userid || !username || !loginid || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if userid or loginid already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ userid }, { loginid }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User ID or Login ID already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        userid,
        username,
        loginid,
        password: hashedPassword,
        role,
        leader: leader || null,
        isActive: isActive ?? true,
        createdBy: 'system',
        updatedBy: 'system',
      },
      select: {
        id: true,
        userid: true,
        username: true,
        loginid: true,
        role: true,
        leader: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
