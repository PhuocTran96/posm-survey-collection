import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all survey responses with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const leader = searchParams.get('leader') || '';
    const storeId = searchParams.get('storeId') || '';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { shopName: { contains: search } },
        { submittedBy: { contains: search } },
      ];
    }

    if (leader) {
      where.leader = leader;
    }

    if (storeId) {
      where.storeId = storeId;
    }

    const [surveys, total] = await Promise.all([
      db.surveyResponse.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { submittedAt: 'desc' },
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
              role: true,
            },
          },
        },
      }),
      db.surveyResponse.count({ where }),
    ]);

    // Parse the JSON responses
    const surveysWithParsedResponses = surveys.map((survey) => ({
      ...survey,
      responses: JSON.parse(survey.responses),
    }));

    return NextResponse.json({
      surveys: surveysWithParsedResponses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    );
  }
}

// POST - Create new survey response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leader, shopName, storeId, submittedById, submittedBy, submittedByRole, responses } = body;

    if (!leader || !shopName || !responses) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const survey = await db.surveyResponse.create({
      data: {
        leader,
        shopName,
        storeId: storeId || null,
        submittedById: submittedById || null,
        submittedBy: submittedBy || 'anonymous',
        submittedByRole: submittedByRole || 'unknown',
        responses: JSON.stringify(responses),
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

    return NextResponse.json({
      ...survey,
      responses: JSON.parse(survey.responses),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json(
      { error: 'Failed to create survey' },
      { status: 500 }
    );
  }
}
