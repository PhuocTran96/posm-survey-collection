import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { writeFile, unlink } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const tempPath = path.join('/tmp', `import_users_${Date.now()}.xlsx`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'read_xlsx.py');
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(tempPath, buffer);
    
    const { stdout } = await execAsync(`python3 "${scriptPath}" "${tempPath}"`);
    await unlink(tempPath).catch(() => {});
    
    const users = JSON.parse(stdout);
    
    if (users.error) {
      return NextResponse.json({ error: users.error }, { status: 400 });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'No users data found in file' }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        const userid = user['User ID'] || user.userid || user['User Id'];
        const username = user['Username'] || user.username;
        const loginid = user['Login ID'] || user.loginid || user['Login Id'];
        const role = user['Role'] || user.role;
        
        if (!userid || !username || !loginid || !role) {
          results.failed++;
          results.errors.push(`Row skipped: Missing required fields for user ${userid || 'unknown'}`);
          continue;
        }

        const validRoles = ['admin', 'TDL', 'TDS', 'PRT', 'user'];
        if (!validRoles.includes(role)) {
          results.failed++;
          results.errors.push(`Row skipped: Invalid role "${role}" for user ${userid}`);
          continue;
        }

        const existing = await db.user.findFirst({
          where: {
            OR: [
              { userid: userid },
              { loginid: loginid },
            ],
          },
        });

        const leader = user['Leader'] || user.leader || null;
        const status = user['Status'] || user.status;

        if (existing) {
          await db.user.update({
            where: { id: existing.id },
            data: {
              username: username,
              role: role,
              leader: leader,
              isActive: status !== 'Inactive',
            },
          });
        } else {
          const defaultPassword = await hash('123456', 10);
          await db.user.create({
            data: {
              userid: userid,
              username: username,
              loginid: loginid,
              password: defaultPassword,
              role: role,
              leader: leader,
              isActive: status !== 'Inactive',
              isSuperAdmin: false,
            },
          });
        }
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Error processing user: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error importing users:', error);
    return NextResponse.json({ error: 'Failed to import users' }, { status: 500 });
  }
}
