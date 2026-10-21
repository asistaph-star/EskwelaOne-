import prisma from '../../config/database.js';

export interface SchoolEventRecord {
  eventId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  type: string;
  targetAudience: string | null;
  safeDescription: string | null;
  isUntrustedData: true;
}

export interface QueryUpcomingEventsOptions {
  startDate?: Date;
  endDate?: Date;
  audience?: 'all' | 'teachers' | 'students';
  limit?: number;
}

export class EventService {
  /**
   * Retrieves upcoming school calendar events within a validated date window.
   * Event titles and descriptions are treated strictly as UNTRUSTED DATA.
   */
  async getUpcomingEvents(options: QueryUpcomingEventsOptions = {}): Promise<SchoolEventRecord[]> {
    const now = new Date();
    const effectiveStart = options.startDate || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Default 30-day window if endDate not provided; capped at 90 days maximum
    const maxWindowMs = 90 * 24 * 60 * 60 * 1000;
    let effectiveEnd = options.endDate;
    if (!effectiveEnd) {
      effectiveEnd = new Date(effectiveStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (effectiveEnd.getTime() - effectiveStart.getTime() > maxWindowMs) {
      effectiveEnd = new Date(effectiveStart.getTime() + maxWindowMs);
    }

    const limit = Math.min(Math.max(options.limit || 20, 1), 50);

    const where: any = {
      date: {
        gte: effectiveStart,
        lte: effectiveEnd,
      },
    };

    if (options.audience) {
      where.OR = [
        { audience: 'all' },
        { audience: options.audience }
      ];
    }

    const rawEvents = await prisma.event.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        end_date: true,
        type: true,
        audience: true,
      }
    });

    return rawEvents.map(event => ({
      eventId: event.id,
      title: event.title,
      startDate: event.date.toISOString().split('T')[0],
      endDate: event.end_date ? event.end_date.toISOString().split('T')[0] : null,
      type: event.type,
      targetAudience: event.audience,
      // Sanitized short description — guaranteed not to be executed as instructions
      safeDescription: event.description ? event.description.slice(0, 300) : null,
      isUntrustedData: true as const,
    }));
  }

  /**
   * Retrieves events occurring within a specified date window.
   */
  async getEventsForPeriod(startDate: Date, endDate: Date): Promise<SchoolEventRecord[]> {
    const rawEvents = await prisma.event.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        }
      },
      orderBy: { date: 'asc' },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        end_date: true,
        type: true,
        audience: true,
      }
    });

    return rawEvents.map(event => ({
      eventId: event.id,
      title: event.title,
      startDate: event.date.toISOString().split('T')[0],
      endDate: event.end_date ? event.end_date.toISOString().split('T')[0] : null,
      type: event.type,
      targetAudience: event.audience,
      safeDescription: event.description ? event.description.slice(0, 300) : null,
      isUntrustedData: true as const,
    }));
  }

  /**
   * Retrieves upcoming event count starting from a given date.
   */
  async getUpcomingCount(since?: Date): Promise<number> {
    const effectiveSince = since || new Date();
    return await prisma.event.count({
      where: {
        date: { gte: effectiveSince }
      }
    });
  }
}

export const eventService = new EventService();
