CREATE TABLE "place_import_batches" (
  "id" TEXT NOT NULL PRIMARY KEY, "dataset" TEXT NOT NULL, "sha256" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "total" INTEGER NOT NULL, "excluded" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "place_import_batches_sha256_key" ON "place_import_batches"("sha256");
CREATE TABLE "imported_places" (
  "id" TEXT NOT NULL PRIMARY KEY, "dataset" TEXT NOT NULL, "externalId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL, "name" TEXT NOT NULL, "provinceCode" TEXT,
  "categoryCodes" TEXT[], "payload" JSONB NOT NULL, "warnings" TEXT[],
  "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING', "version" INTEGER NOT NULL DEFAULT 1,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "reason" TEXT, "placeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "imported_places_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "place_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "imported_places_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "imported_places_dataset_externalId_key" ON "imported_places"("dataset", "externalId");
CREATE INDEX "imported_places_status_provinceCode_createdAt_idx" ON "imported_places"("status", "provinceCode", "createdAt");
CREATE TABLE "_AdditionalPlaceCategories" (
  "A" TEXT NOT NULL, "B" TEXT NOT NULL,
  CONSTRAINT "_AdditionalPlaceCategories_AB_pkey" PRIMARY KEY ("A","B"),
  CONSTRAINT "_AdditionalPlaceCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "_AdditionalPlaceCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "_AdditionalPlaceCategories_B_index" ON "_AdditionalPlaceCategories"("B");
