-- Remove the retired public place-source field and any duplicated source list
-- embedded in published place metadata. Import provenance remains available in
-- imported_places.payload and audit_logs.
UPDATE "places"
SET "categoryDetails" = jsonb_set(
  "categoryDetails",
  '{import}',
  ("categoryDetails" -> 'import') - 'sources'
)
WHERE jsonb_typeof("categoryDetails" -> 'import') = 'object'
  AND ("categoryDetails" -> 'import') ? 'sources';

ALTER TABLE "places" DROP COLUMN "sourceUrl";
