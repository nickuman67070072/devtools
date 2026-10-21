-- Remove the retired generated place dataset and records that cannot exist without it.
CREATE TEMP TABLE "_removed_demo_places" ON COMMIT DROP AS
SELECT "id", "slug"
FROM "places"
WHERE "isDemoData" = true OR "source" = 'DEMO';

CREATE TEMP TABLE "_removed_demo_meetups" ON COMMIT DROP AS
SELECT "id"
FROM "meetups"
WHERE "placeId" IN (SELECT "id" FROM "_removed_demo_places");

CREATE TEMP TABLE "_removed_demo_submissions" ON COMMIT DROP AS
SELECT "id"
FROM "submissions"
WHERE "targetPlaceId" IN (SELECT "id" FROM "_removed_demo_places");

CREATE TEMP TABLE "_removed_demo_meetup_reports" ON COMMIT DROP AS
SELECT "id"
FROM "meetup_reports"
WHERE "meetupId" IN (SELECT "id" FROM "_removed_demo_meetups");

DELETE FROM "notifications"
WHERE "link" IN (
  SELECT '/places/' || "id" FROM "_removed_demo_places"
  UNION
  SELECT '/places/' || "slug" FROM "_removed_demo_places"
  UNION
  SELECT '/meetups/' || "id" FROM "_removed_demo_meetups"
  UNION
  SELECT '/meetups/' || "id" || '/chat' FROM "_removed_demo_meetups"
)
OR "metadata"->>'placeId' IN (SELECT "id" FROM "_removed_demo_places")
OR "metadata"->>'meetupId' IN (SELECT "id" FROM "_removed_demo_meetups");

DELETE FROM "audit_logs"
WHERE ("entityType" = 'Place' AND "entityId" IN (SELECT "id" FROM "_removed_demo_places"))
   OR ("entityType" = 'Meetup' AND "entityId" IN (SELECT "id" FROM "_removed_demo_meetups"))
   OR ("entityType" = 'MeetupReport' AND "entityId" IN (SELECT "id" FROM "_removed_demo_meetup_reports"))
   OR ("entityType" = 'Submission' AND "entityId" IN (SELECT "id" FROM "_removed_demo_submissions"));

DELETE FROM "submissions"
WHERE "id" IN (SELECT "id" FROM "_removed_demo_submissions");

DELETE FROM "meetups"
WHERE "id" IN (SELECT "id" FROM "_removed_demo_meetups");

DELETE FROM "places"
WHERE "id" IN (SELECT "id" FROM "_removed_demo_places");

-- The legacy column and enum value remain physically present for blue/green rollback
-- compatibility. They are no longer part of the Prisma schema or application code.
