import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all stores with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const region = searchParams.get('region') || '';
    const channel = searchParams.get('channel') || '';
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { storeId: { contains: search } },
        { storeCode: { contains: search } },
        { storeName: { contains: search } },
      ];
    }

    if (region) {
      where.region = region;
    }

    if (channel) {
      where.channel = channel;
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [stores, total] = await Promise.all([
      db.store.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { displays: true, surveyResponses: true },
          },
        },
      }),
      db.store.count({ where }),
    ]);

    return NextResponse.json({
      stores,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

// POST - Create new store
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storeId, storeCode, storeName, channel, hc, region, province, mcp, tdl, tds } = body;

    if (!storeId || !storeName || !channel || !region || !province) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const existingStore = await db.store.findUnique({
      where: { storeId },
    });

    if (existingStore) {
      return NextResponse.json(
        { error: 'Store ID already exists' },
        { status: 400 }
      );
    }

    const store = await db.store.create({
      data: {
        storeId,
        storeCode,
        storeName,
        channel,
        hc: hc || 0,
        region,
        province,
        mcp: mcp || 'N',
        tdl,
        tds,
        isActive: true,
        createdBy: 'system',
        updatedBy: 'system',
      },
    });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { error: 'Failed to create store' },
      { status: 500 }
    );
  }
}
