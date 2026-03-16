import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    const stores = await db.store.findMany({
      select: {
        storeId: true,
        storeCode: true,
        storeName: true,
        channel: true,
        hc: true,
        region: true,
        province: true,
        mcp: true,
        tdl: true,
        tds: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = stores.map((store) => ({
      'Store ID': store.storeId,
      'Store Code': store.storeCode || '',
      'Store Name': store.storeName,
      'Channel': store.channel,
      'HC': store.hc,
      'Region': store.region,
      'Province': store.province,
      'MCP': store.mcp,
      'TDL': store.tdl || '',
      'TDS': store.tds || '',
      'Status': store.isActive ? 'Active' : 'Inactive',
      'Created At': store.createdAt.toISOString(),
    }));

    const outputPath = path.join('/tmp', `stores_${Date.now()}.xlsx`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_xlsx.py');
    
    await execAsync(`python3 "${scriptPath}" stores '${JSON.stringify(data)}' "${outputPath}"`);
    
    const fileBuffer = await readFile(outputPath);
    
    await unlink(outputPath).catch(() => {});
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="stores.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error exporting stores:', error);
    return NextResponse.json({ error: 'Failed to export stores' }, { status: 500 });
  }
}
