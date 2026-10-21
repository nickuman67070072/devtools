CREATE TYPE "MeetupJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "meetup_join_requests" (
  "id" TEXT NOT NULL,
  "meetupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "MeetupJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meetup_join_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meetup_join_requests_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meetup_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "meetup_join_requests_meetupId_userId_key" ON "meetup_join_requests"("meetupId", "userId");
CREATE INDEX "meetup_join_requests_meetupId_status_createdAt_idx" ON "meetup_join_requests"("meetupId", "status", "createdAt");
CREATE INDEX "meetup_join_requests_userId_status_createdAt_idx" ON "meetup_join_requests"("userId", "status", "createdAt");
