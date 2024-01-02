import { createMetricProcessor } from '~/server/metrics/base.metrics';
import { Prisma } from '@prisma/client';

export const clubMetrics = createMetricProcessor({
  name: 'Club',
  async update({ db, lastUpdate }) {
    const recentEngagementSubquery = Prisma.sql`
    -- Get all engagements that have happened since then that affect metrics
    WITH recent_engagements AS
    (
      SELECT
          COALESCE(c.id, ct."clubId") "clubId"
      FROM "EntityAccess" ea
      LEFT JOIN "Club" c ON ea."accessorId" = c.id AND ea."accessorType" = 'Club'
      LEFT JOIN "ClubTier" ct ON ea."accessorId" = ct."clubId" AND ea."accessorType" = 'ClubTier'
      WHERE COALESCE(c.id, ct."clubId") IS NOT NULL AND ea."addedAt" > ${lastUpdate}

      UNION

      SELECT
        "clubId" AS id
      FROM "Club"
      WHERE ("createdAt" > ${lastUpdate})

      UNION

      SELECT
        "clubId" AS id
      FROM "ClubMembership"
      WHERE ("startedAt" > ${lastUpdate})

      UNION

      SELECT
        "id"
      FROM "Club"
      WHERE ("createdAt" > ${lastUpdate})

      UNION

      SELECT
        "id"
      FROM "MetricUpdateQueue"
      WHERE type = 'Club'
    )
    `;

    await db.$executeRaw`
      ${recentEngagementSubquery},
      -- Get all affected
      affected AS
      (
          SELECT DISTINCT
              r.id
          FROM recent_engagements r
          JOIN "Club" c ON c.id = r.id
          WHERE r.id IS NOT NULL
      )
      -- upsert metrics for all affected
      -- perform a one-pass table scan producing all metrics for all affected users
      INSERT INTO "ClubMetric" ("clubPostId", timeframe, "heartCount")
      SELECT
        m.id,
        tf.timeframe, 
        CASE
          WHEN tf.timeframe = 'AllTime' THEN heart_count
          WHEN tf.timeframe = 'Year' THEN year_heart_count
          WHEN tf.timeframe = 'Month' THEN month_heart_count
          WHEN tf.timeframe = 'Week' THEN week_heart_count
          WHEN tf.timeframe = 'Day' THEN day_heart_count
        END AS heart_count
      FROM
      (
        SELECT
          a.id,
          COALESCE(cm.member_count, 0) AS member_count,
          COALESCE(cm.year_member_count, 0) AS year_member_count,
          COALESCE(cm.month_member_count, 0) AS month_member_count,
          COALESCE(cm.week_member_count, 0) AS week_member_count,
          COALESCE(cm.day_member_count, 0) AS day_member_count
        FROM affected a
        LEFT JOIN (
          SELECT
            cm."clubId",
            COUNT(*) AS member_count,
            SUM(IIF(cm."startedAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_member_count,
            SUM(IIF(cm."startedAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_member_count,
            SUM(IIF(cm."startedAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_member_count,
            SUM(IIF(cm."startedAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_member_count, 
          FROM "ClubMembership" cm
          WHERE cm."expiresAt" IS NULL OR cm."expiresAt" > NOW()
          GROUP BY cm."clubId"
        ) cm ON cm."clubId" = a.id
        LEFT JOIN (
          SELECT
            COALESCE(c.id, ct."clubId") "clubId",
            COUNT(DISTINCT CONCAT(ea."accessToType", '-', ea."accessToId")) AS resource_count,
            -- TODO: This sum might be innacurate if an item was added to multiple tiers. We should probably
            -- figure out a way to dedupe, but since we mostly care for all time right now, might move on.
            SUM(IIF(ea."addedAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_resource_count,
            SUM(IIF(ea."addedAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_resource_count,
            SUM(IIF(ea."addedAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_resource_count,
            SUM(IIF(ea."addedAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_resource_count
          FROM "EntityAccess" ea
          LEFT JOIN "Club" c ON ea."accessorId" = c.id AND ea."accessorType" = 'Club'
          LEFT JOIN "ClubTier" ct ON ea."accessorId" = ct."clubId" AND ea."accessorType" = 'ClubTier'
          WHERE  ea."accessorType" IN ('Club', 'ClubTier')
            AND COALESCE(c.id, ct."clubId") IS NOT NULL  
          GROUP BY COALESCE(c.id, ct."clubId")
        ) ea ON ea."clubId" = a.id
      ) m
      CROSS JOIN (
        SELECT unnest(enum_range(NULL::"MetricTimeframe")) AS timeframe
      ) tf
      ON CONFLICT ("clubPostId", timeframe) DO UPDATE
        SET "likeCount" = EXCLUDED."likeCount", "dislikeCount" = EXCLUDED."dislikeCount", "laughCount" = EXCLUDED."laughCount",  "cryCount" = EXCLUDED."cryCount", "heartCount" = EXCLUDED."heartCount";
    `;
  },
  async clearDay({ db }) {
    await db.$executeRaw`
      UPDATE "ClubMetric" SET "likeCount" = 0, "dislikeCount" = 0, "laughCount" = 0, "cryCount" = 0, "heartCount" = 0  WHERE timeframe = 'Day';
    `;
  },
});
