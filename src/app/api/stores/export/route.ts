import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Convert to CSV-like structure for xlsx
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

    return NextResponse.json({ stores: data, total: stores.length });
  } catch (error) {
    console.error('Error exporting stores:', error);
    return NextResponse.json({ error: 'Failed to export stores' }, { status: 500 });
  }
}
