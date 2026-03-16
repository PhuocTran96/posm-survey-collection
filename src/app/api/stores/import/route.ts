import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

    const tempPath = path.join('/tmp', `import_stores_${Date.now()}.xlsx`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'read_xlsx.py');
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(tempPath, buffer);
    
    const { stdout } = await execAsync(`python3 "${scriptPath}" "${tempPath}"`);
    await unlink(tempPath).catch(() => {});
    
    const stores = JSON.parse(stdout);
    
    if (stores.error) {
      return NextResponse.json({ error: stores.error }, { status: 400 });
    }

    if (!Array.isArray(stores) || stores.length === 0) {
      return NextResponse.json({ error: 'No stores data found in file' }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const store of stores) {
      try {
        const storeId = store['Store ID'] || store.storeId;
        const storeName = store['Store Name'] || store.storeName;
        const region = store['Region'] || store.region;
        const province = store['Province'] || store.province;
        
        if (!storeId || !storeName || !region || !province) {
          results.failed++;
          results.errors.push(`Row skipped: Missing required fields for store ${storeId || 'unknown'}`);
          continue;
        }

        const existing = await db.store.findFirst({
          where: {
            OR: [
              { storeId: storeId },
              { storeName: storeName },
            ],
          },
        });

        if (existing) {
          await db.store.update({
            where: { id: existing.id },
            data: {
              storeCode: store['Store Code'] || store.storeCode || existing.storeCode,
              channel: store['Channel'] || store.channel || existing.channel,
              hc: parseInt(store['HC'] || store.hc) || existing.hc,
              region: region,
              province: province,
              mcp: store['MCP'] || store.mcp || existing.mcp,
              tdl: store['TDL'] || store.tdl || existing.tdl,
              tds: store['TDS'] || store.tds || existing.tds,
              isActive: (store['Status'] || store.status) !== 'Inactive',
            },
          });
        } else {
          await db.store.create({
            data: {
              storeId: storeId,
              storeCode: store['Store Code'] || store.storeCode || null,
              storeName: storeName,
              channel: store['Channel'] || store.channel || 'GT',
              hc: parseInt(store['HC'] || store.hc) || 0,
              region: region,
              province: province,
              mcp: store['MCP'] || store.mcp || 'N',
              tdl: store['TDL'] || store.tdl || null,
              tds: store['TDS'] || store.tds || null,
              isActive: (store['Status'] || store.status) !== 'Inactive',
            },
          });
        }
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Error processing store: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error importing stores:', error);
    return NextResponse.json({ error: 'Failed to import stores' }, { status: 500 });
  }
}
