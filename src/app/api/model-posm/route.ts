import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all model POSM mappings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model') || '';
    const category = searchParams.get('category') || '';

    const where: Record<string, unknown> = {};

    if (model) {
      where.model = { contains: model };
    }

    if (category) {
      where.category = category;
    }

    const modelPosms = await db.modelPosm.findMany({
      where,
      orderBy: [{ model: 'asc' }, { posm: 'asc' }],
    });

    // Group by model for easier frontend consumption
    const groupedByModel = modelPosms.reduce((acc, mp) => {
      if (!acc[mp.model]) {
        acc[mp.model] = [];
      }
      acc[mp.model].push({
        posm: mp.posm,
        posmName: mp.posmName,
        category: mp.category,
        project: mp.project,
      });
      return acc;
    }, {} as Record<string, unknown[]>);

    return NextResponse.json({
      modelPosms,
      groupedByModel,
      models: [...new Set(modelPosms.map((mp) => mp.model))],
      categories: [...new Set(modelPosms.map((mp) => mp.category).filter(Boolean))],
    });
  } catch (error) {
    console.error('Error fetching model POSM:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model POSM' },
      { status: 500 }
    );
  }
}

// POST - Create new model POSM mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, posm, posmName, category, project } = body;

    if (!model || !posm || !posmName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const existing = await db.modelPosm.findUnique({
      where: { model_posm: { model, posm } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Model POSM mapping already exists' },
        { status: 400 }
      );
    }

    const modelPosm = await db.modelPosm.create({
      data: {
        model,
        posm,
        posmName,
        category: category || null,
        project: project || null,
      },
    });

    return NextResponse.json(modelPosm, { status: 201 });
  } catch (error) {
    console.error('Error creating model POSM:', error);
    return NextResponse.json(
      { error: 'Failed to create model POSM' },
      { status: 500 }
    );
  }
}
