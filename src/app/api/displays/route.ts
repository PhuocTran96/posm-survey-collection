import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all displays with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const storeId = searchParams.get('storeId') || '';
    const model = searchParams.get('model') || '';
    const isDisplayed = searchParams.get('isDisplayed');

    const where: Record<string, unknown> = {};

    if (storeId) {
      where.storeId = storeId;
    }

    if (model) {
      where.model = { contains: model };
    }

    if (isDisplayed !== null && isDisplayed !== undefined && isDisplayed !== '') {
      where.isDisplayed = isDisplayed === 'true';
    }

    const [displays, total] = await Promise.all([
      db.display.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          store: {
            select: {
              storeId: true,
              storeName: true,
              region: true,
              province: true,
            },
          },
          user: {
            select: {
              userid: true,
              username: true,
            },
          },
        },
      }),
      db.display.count({ where }),
    ]);

    return NextResponse.json({
      displays,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching displays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch displays' },
      { status: 500 }
    );
  }
}

// POST - Create or update display
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storeId, model, isDisplayed, userId } = body;

    if (!storeId || !model) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if display already exists
    const existingDisplay = await db.display.findFirst({
      where: { storeId, model },
    });

    if (existingDisplay) {
      // Update existing
      const updated = await db.display.update({
        where: { id: existingDisplay.id },
        data: {
          isDisplayed: isDisplayed ?? true,
          userId: userId || null,
          updatedBy: 'system',
        },
        include: {
          store: {
            select: {
              storeId: true,
              storeName: true,
            },
          },
        },
      });
      return NextResponse.json(updated);
    }

    // Create new
    const display = await db.display.create({
      data: {
        storeId,
        model,
        isDisplayed: isDisplayed ?? true,
        userId: userId || null,
        createdBy: 'system',
        updatedBy: 'system',
      },
      include: {
        store: {
          select: {
            storeId: true,
            storeName: true,
          },
        },
      },
    });

    return NextResponse.json(display, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating display:', error);
    return NextResponse.json(
      { error: 'Failed to create/update display' },
      { status: 500 }
    );
  }
}
