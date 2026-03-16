import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stores } = body;

    if (!Array.isArray(stores) || stores.length === 0) {
      return NextResponse.json({ error: 'No stores data provided' }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const store of stores) {
      try {
        // Validate required fields
        if (!store['Store ID'] || !store['Store Name'] || !store['Region'] || !store['Province']) {
          results.failed++;
          results.errors.push(`Row skipped: Missing required fields for store ${store['Store ID'] || 'unknown'}`);
          continue;
        }

        // Check if store already exists
        const existing = await db.store.findFirst({
          where: {
            OR: [
              { storeId: store['Store ID'] },
              { storeName: store['Store Name'] },
            ],
          },
        });

        if (existing) {
          // Update existing store
          await db.store.update({
            where: { id: existing.id },
            data: {
              storeCode: store['Store Code'] || existing.storeCode,
              channel: store['Channel'] || existing.channel,
              hc: parseInt(store['HC']) || existing.hc,
              region: store['Region'] || existing.region,
              province: store['Province'] || existing.province,
              mcp: store['MCP'] || existing.mcp,
              tdl: store['TDL'] || existing.tdl,
              tds: store['TDS'] || existing.tds,
              isActive: store['Status'] === 'Inactive' ? false : true,
            },
          });
        } else {
          // Create new store
          await db.store.create({
            data: {
              storeId: store['Store ID'],
              storeCode: store['Store Code'] || null,
              storeName: store['Store Name'],
              channel: store['Channel'] || 'GT',
              hc: parseInt(store['HC']) || 0,
              region: store['Region'],
              province: store['Province'],
              mcp: store['MCP'] || 'N',
              tdl: store['TDL'] || null,
              tds: store['TDS'] || null,
              isActive: store['Status'] !== 'Inactive',
            },
          });
        }
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Error processing store ${store['Store ID']}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error importing stores:', error);
    return NextResponse.json({ error: 'Failed to import stores' }, { status: 500 });
  }
}
