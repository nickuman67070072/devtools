ALTER TABLE "meetup_messages" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "meetup_messages_meetupId_updatedAt_idx" ON "meetup_messages"("meetupId", "updatedAt");
