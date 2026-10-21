ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETUP';

CREATE TYPE "MeetupStatus" AS ENUM ('OPEN', 'CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MeetupMemberState" AS ENUM ('ACTIVE', 'LEFT', 'KICKED');
CREATE TYPE "MeetupMessageKind" AS ENUM ('TEXT', 'IMAGE', 'SYSTEM');
CREATE TYPE "MeetupReportTarget" AS ENUM ('MEETUP', 'USER', 'MESSAGE', 'IMAGE');
CREATE TYPE "MeetupReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'SCAM', 'FAKE_MEETUP', 'DANGEROUS_BEHAVIOR', 'OTHER');

CREATE TABLE "meetups" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "rules" TEXT,
  "coverObjectKey" TEXT,
  "status" "MeetupStatus" NOT NULL DEFAULT 'OPEN',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "maxMembers" INTEGER NOT NULL,
  "hostId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "reminderSentAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meetups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meetups_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "meetups_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "meetups_time_check" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "meetups_capacity_check" CHECK ("maxMembers" BETWEEN 2 AND 50)
);
CREATE UNIQUE INDEX "meetups_coverObjectKey_key" ON "meetups"("coverObjectKey");
CREATE INDEX "meetups_status_startsAt_idx" ON "meetups"("status", "startsAt");
CREATE INDEX "meetups_placeId_startsAt_idx" ON "meetups"("placeId", "startsAt");
CREATE INDEX "meetups_hostId_createdAt_idx" ON "meetups"("hostId", "createdAt");

CREATE TABLE "meetup_members" (
  "id" TEXT NOT NULL,
  "meetupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" "MeetupMemberState" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "meetup_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meetup_members_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meetup_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "meetup_members_meetupId_userId_key" ON "meetup_members"("meetupId", "userId");
CREATE INDEX "meetup_members_meetupId_state_idx" ON "meetup_members"("meetupId", "state");
CREATE INDEX "meetup_members_userId_state_idx" ON "meetup_members"("userId", "state");

CREATE TABLE "meetup_bans" (
  "id" TEXT NOT NULL,
  "meetupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meetup_bans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meetup_bans_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meetup_bans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "meetup_bans_meetupId_userId_key" ON "meetup_bans"("meetupId", "userId");

CREATE TABLE "meetup_messages" (
  "id" TEXT NOT NULL,
  "meetupId" TEXT NOT NULL,
  "authorId" TEXT,
  "kind" "MeetupMessageKind" NOT NULL,
  "text" TEXT,
  "objectKey" TEXT,
  "replyToId" TEXT,
  "pinnedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meetup_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meetup_messages_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meetup_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "meetup_messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "meetup_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "meetup_messages_objectKey_key" ON "meetup_messages"("objectKey");
CREATE INDEX "meetup_messages_meetupId_createdAt_id_idx" ON "meetup_messages"("meetupId", "createdAt", "id");

CREATE TABLE "meetup_reports" (
  "id" TEXT NOT NULL,
  "meetupId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "target" "MeetupReportTarget" NOT NULL,
  "targetId" TEXT NOT NULL,
  "reason" "MeetupReportReason" NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "meetup_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meetup_reports_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meetup_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "meetup_reports_status_createdAt_idx" ON "meetup_reports"("status", "createdAt");
CREATE INDEX "meetup_reports_meetupId_target_idx" ON "meetup_reports"("meetupId", "target");

CREATE TABLE "user_blocks" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_blocks_not_self_check" CHECK ("blockerId" <> "blockedId")
);
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");

CREATE TABLE "meetup_notification_events" (
  "id" TEXT NOT NULL,
  "meetupId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meetup_notification_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meetup_notification_events_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "meetup_notification_events_meetupId_eventKey_key" ON "meetup_notification_events"("meetupId", "eventKey");
