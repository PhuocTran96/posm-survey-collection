import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Dashboard statistics
export async function GET() {
  try {
    // Get counts
    const [
      totalStores,
      activeStores,
      totalUsers,
      activeUsers,
      totalSurveys,
      totalDisplays,
      displayedCount,
      storesByRegion,
      storesByChannel,
      usersByRole,
      recentSurveys,
      recentUsers,
    ] = await Promise.all([
      db.store.count(),
      db.store.count({ where: { isActive: true } }),
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.surveyResponse.count(),
      db.display.count(),
      db.display.count({ where: { isDisplayed: true } }),
      db.store.groupBy({
        by: ['region'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      db.store.groupBy({
        by: ['channel'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      db.user.groupBy({
        by: ['role'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      db.surveyResponse.findMany({
        take: 5,
        orderBy: { submittedAt: 'desc' },
        include: {
          store: {
            select: {
              storeName: true,
            },
          },
        },
      }),
      db.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userid: true,
          username: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    // Get surveys per day for the last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const surveysLastWeek = await db.surveyResponse.groupBy({
      by: ['submittedAt'],
      where: {
        submittedAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: { id: true },
    });

    // Format recent surveys
    const formattedRecentSurveys = recentSurveys.map((survey) => ({
      ...survey,
      responses: JSON.parse(survey.responses),
    }));

    return NextResponse.json({
      counts: {
        totalStores,
        activeStores,
        totalUsers,
        activeUsers,
        totalSurveys,
        totalDisplays,
        displayedCount,
        displayRate: totalDisplays > 0 ? Math.round((displayedCount / totalDisplays) * 100) : 0,
      },
      charts: {
        storesByRegion: storesByRegion.map((s) => ({
          name: s.region,
          value: s._count.id,
        })),
        storesByChannel: storesByChannel.map((s) => ({
          name: s.channel,
          value: s._count.id,
        })),
        usersByRole: usersByRole.map((s) => ({
          name: s.role,
          value: s._count.id,
        })),
        surveysLastWeek: surveysLastWeek.length,
      },
      recent: {
        surveys: formattedRecentSurveys,
        users: recentUsers,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
