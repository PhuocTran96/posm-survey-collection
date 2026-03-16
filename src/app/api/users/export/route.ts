import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

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

    const data = users.map((user) => ({
      'User ID': user.userid,
      'Username': user.username,
      'Login ID': user.loginid,
      'Role': user.role,
      'Leader': user.leader || '',
      'Status': user.isActive ? 'Active' : 'Inactive',
      'Created At': user.createdAt.toISOString(),
    }));

    const outputPath = path.join('/tmp', `users_${Date.now()}.xlsx`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_xlsx.py');
    
    await execAsync(`python3 "${scriptPath}" users '${JSON.stringify(data)}' "${outputPath}"`);
    
    const fileBuffer = await readFile(outputPath);
    
    await unlink(outputPath).catch(() => {});
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="users.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json({ error: 'Failed to export users' }, { status: 500 });
  }
}
