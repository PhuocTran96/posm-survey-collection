import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { users } = body;

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'No users data provided' }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        // Validate required fields
        if (!user['User ID'] || !user['Username'] || !user['Login ID'] || !user['Role']) {
          results.failed++;
          results.errors.push(`Row skipped: Missing required fields for user ${user['User ID'] || 'unknown'}`);
          continue;
        }

        // Validate role
        const validRoles = ['admin', 'TDL', 'TDS', 'PRT', 'user'];
        if (!validRoles.includes(user['Role'])) {
          results.failed++;
          results.errors.push(`Row skipped: Invalid role "${user['Role']}" for user ${user['User ID']}`);
          continue;
        }

        // Check if user already exists
        const existing = await db.user.findFirst({
          where: {
            OR: [
              { userid: user['User ID'] },
              { loginid: user['Login ID'] },
            ],
          },
        });

        if (existing) {
          // Update existing user (don't update password on import)
          await db.user.update({
            where: { id: existing.id },
            data: {
              username: user['Username'] || existing.username,
              role: user['Role'] || existing.role,
              leader: user['Leader'] || existing.leader,
              isActive: user['Status'] === 'Inactive' ? false : true,
            },
          });
        } else {
          // Create new user with default password
          const defaultPassword = await hash('123456', 10);
          await db.user.create({
            data: {
              userid: user['User ID'],
              username: user['Username'],
              loginid: user['Login ID'],
              password: defaultPassword,
              role: user['Role'],
              leader: user['Leader'] || null,
              isActive: user['Status'] !== 'Inactive',
              isSuperAdmin: false,
            },
          });
        }
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Error processing user ${user['User ID']}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error importing users:', error);
    return NextResponse.json({ error: 'Failed to import users' }, { status: 500 });
  }
}
