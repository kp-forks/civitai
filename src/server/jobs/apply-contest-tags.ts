import { createJob, getJobDate } from './job';
import { dbWrite } from '~/server/db/client';
import { getSystemTags } from '~/server/services/system-cache';
import { Prisma } from '@prisma/client';

export const applyContestTags = createJob('apply-contest-tags', '*/2 * * * *', async () => {
  // Get the last sent time
  // --------------------------------------------
  const [lastApplied, setLastApplied] = await getJobDate('last-contest-tags-applied');

  // Get post tags with the contest tag
  // --------------------------------------------
  const systemTags = await getSystemTags();
  const contestTag = systemTags.find((t) => t.name === 'contest');
  if (!contestTag) return;
  const postTags = await dbWrite.$queryRaw<{ id: number; name: string }[]>`
    -- Get post tags with the contest tag
    SELECT DISTINCT
      t.id,
      t.name
    FROM "Tag" t
    JOIN "TagsOnTags" tt ON tt."toTagId" = t.id AND tt."fromTagId" = ${contestTag.id}
  `;
  if (!postTags.length) return;

  const postTagIds = Prisma.join(postTags.map((t) => t.id));
  // Apply tags to images
  // --------------------------------------------
  // TODO.TagsOnImage - remove this after the migration
  const results = await dbWrite.$queryRaw<{ imageId: number; tagId: number }[]>`
    -- Apply contest tags
    WITH affected AS (
      SELECT DISTINCT i.id
      FROM "Image" i
      JOIN "TagsOnPost" top ON top."postId" = i."postId"
      WHERE top."tagId" IN (${postTagIds}) AND i."createdAt" > ${lastApplied}

      UNION

      SELECT DISTINCT i.id
      FROM "TagsOnPost" top
      JOIN "Image" i ON i."postId" = top."postId"
      WHERE top."tagId" IN (${postTagIds}) AND top."createdAt" > ${lastApplied}
    )
    INSERT INTO "TagsOnImage"("tagId", "imageId", "confidence","automated")
    SELECT
      t.id,
      a.id,
      100,
      true
    FROM affected a
    JOIN "Tag" t ON t.id IN (${postTagIds})
    ON CONFLICT ("tagId", "imageId") DO NOTHING
    RETURNING "tagId", "imageId";
  `;

  await dbWrite.$queryRaw`
    -- Apply contest tags
    WITH to_insert AS (
      SELECT
        (value ->> 'imageId')::int as "imageId",
        (value ->> 'tagId')::int as "tagId"
      FROM json_array_elements(${JSON.stringify(results)}::json)
    )
    SELECT upsert_tag_on_image("imageId", "tagId", 'User', 100, true)
    FROM to_insert;
  `;

  // Update the last sent time
  // --------------------------------------------
  await setLastApplied();
});
