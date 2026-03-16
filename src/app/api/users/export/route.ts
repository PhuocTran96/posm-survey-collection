import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const users = await db.user.findMany({
      select: {
        userid: true,
        username: true,
        loginid: true,
        role: true,
        leader: true,
        isActive: true,
        isSuperAdmin: true,
        lastLogin: true,
        createdAt: true,
        _count: {
          select: {
            assignedStores: true,
            surveyResponses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert to structure for xlsx
    const data = users.map((user) => ({
      'User ID': user.userid,
      'Username': user.username,
      'Login ID': user.loginid,
      'Role': user.role,
      'Leader': user.leader || '',
      'Status': user.isActive ? 'Active' : 'Inactive',
      'Super Admin': user.isSuperAdmin ? 'Yes' : 'No',
      'Assigned Stores': user._count.assignedStores,
      'Survey Responses': user._count.surveyResponses,
      'Last Login': user.lastLogin ? user.lastLogin.toISOString() : '',
      'Created At': user.createdAt.toISOString(),
    }));

    return NextResponse.json({ users: data, total: users.length });
  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json({ error: 'Failed to export users' }, { status: 500 });
  }
}
