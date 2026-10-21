# PawMap Thailand — เอกสารส่งต่องาน

เอกสารนี้เป็นจุดเริ่มต้นสำหรับผู้รับช่วงพัฒนา อ่านให้ครบก่อนแก้ฐานข้อมูล, deployment หรือข้อมูลสถานที่

## 1. สถานะโครงการ

PawMap เป็น Next.js/TypeScript application สำหรับค้นหาสถานที่ที่ต้อนรับสัตว์เลี้ยงทั่วประเทศไทย รองรับภาษาไทยและอังกฤษ มีแผนที่ไทย 3D, แผนที่ถนน, authentication, contributions, reviews, favorites, reports, notifications, Social Meetup/แชต และ Admin moderation

ข้อมูลที่มากับ repository เป็น snapshot สาธารณะ 3,091 สถานที่, 16 หมวด, 77 จังหวัด และ 926 อำเภอ ไม่มีฐานผู้ใช้หรือบัญชีเริ่มต้น

Repository นี้เป็น private handoff ไม่มี GitHub Actions และยังไม่ได้กำหนด public domain/TLS/SMTP provider จริง

## 2. Architecture

```text
Browser
  -> Nginx blue/green
     -> Next.js standalone app
        -> PostgreSQL (application data)
        -> externally managed S3-compatible storage (uploaded media)
        -> SMTP provider or Mailpit (password reset)

Jenkins
  -> local source checkout
  -> ephemeral PostgreSQL/Mailpit for CI; memory object store is isolated to E2E
  -> tests, build, scans
  -> migration backup, blue/green deploy, smoke, rollback
```

Production application image รันด้วย non-root user ส่วน database, object storage และ Jenkins ต้องไม่เปิดสู่ public network

## 3. โครงสร้างสำคัญ

- `src/app/`: routes และ API
- `src/features/`: UI/workflow แยกตาม feature
- `src/lib/`: domain, repository, security และ shared services
- `prisma/schema.prisma`: database schema
- `prisma/migrations/`: migrations ตามลำดับ
- `prisma/data/`: sanitized public-place snapshot และ manifest
- `public/data/boundaries/`: province/district snapshots
- `public/models/`: Thailand 3D model และ license notices
- `infra/`: Compose, Jenkins, Nginx, workers และ deploy scripts
- `tests/`: unit, integration และ Playwright E2E

## 4. Routes และ workflows

- Public: `/`, `/explore`, `/places/[slug]`, `/emergency`, `/meetups`
- English equivalents: `/en/...`
- Auth: register, login, logout, forgot/reset password
- User: profile, favorites, submissions, reviews, notifications, my meetups
- Meetup: discovery, create/edit, join request approval, member management, chat และ reports
- Admin: dashboard, submissions, places, categories, provinces, users, import review, meetup moderation และ audit logs
- Health: `/api/health/live`, `/api/health/ready`

Protected actions ตรวจ session, role, ownership, suspension และ origin ฝั่ง server ห้ามย้าย authorization ไปพึ่ง client UI

## 5. Setup จาก clean clone

Prerequisites: Node.js 22+, npm, Docker Desktop/Engine และ PostgreSQL 17

```powershell
Set-Location <PROJECT_ROOT>
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run places:import-public
```

กรอก `.env` ด้วยค่าที่สร้างใหม่ก่อนรัน ห้ามคัดลอก secret จากเอกสาร, commit เก่า หรือ environment อื่น

สร้าง Admin ครั้งแรก:

```powershell
npm run admin:create -- <ADMIN_EMAIL> <PASSWORD_FILE_OUTSIDE_REPOSITORY>
```

เริ่มระบบ:

```powershell
npm run dev
```

## 6. ข้อมูลสถานที่

Snapshot อยู่ที่ `prisma/data/public-places.v1.json.gz` และ checksum อยู่ที่ `prisma/data/public-places.manifest.json`

Snapshot มีเฉพาะข้อมูลที่ใช้แสดงสถานที่ ไม่รวม users, sessions, reviews, submissions, meetups, notifications, audit logs, import queue, raw provenance หรือ uploaded media

`npm run places:import-public` ตรวจ checksum/schema และ upsert แบบ idempotent หลัง import ต้องได้ 3,091 สถานที่ หากจำนวนไม่ตรงให้หยุดและตรวจ ห้ามเปลี่ยน expected count เพื่อข้ามข้อผิดพลาด

## 7. Environment variables

เครื่องพัฒนาและ Jenkins agent ต้องใช้ Node.js `22.19.0` ขึ้นไป

ค่าจริงต้องอยู่ใน ignored `.env`, Jenkins Credentials หรือ secret manager เท่านั้น:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ORIGIN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `NOMINATIM_BASE_URL`, `NOMINATIM_CONTACT_EMAIL`
- local Docker: `CONTAINER_DATABASE_URL`, `CONTAINER_S3_ENDPOINT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`; ค่า object storage ต้องชี้ไปยัง S3-compatible service ที่ผู้รับงานจัดการภายนอก

ห้ามนำ secret ไปใส่ตัวแปร `NEXT_PUBLIC_*` เพราะค่าจะเข้า client bundle

Generic SMTP รองรับ provider ภายนอกแล้ว แต่ยังต้องกำหนด credentials และ sender domain จริงก่อน public deployment

## 8. Tests และ verification

```powershell
npm run verify:release
npm run verify:no-github
npm run verify:sources
npm run verify:data
npm run verify:migrations
npm run verify:interactions
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```

Authenticated tests ต้องได้รับ `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_USER_EMAIL` และ `SEED_USER_PASSWORD` จาก test environment เท่านั้น

Playwright ต้องตรวจไทย/อังกฤษ, desktop/tablet/mobile, keyboard, axe, RBAC, IDOR, map modes, submissions และ Meetup workflows

## 9. Jenkins และ deployment

Jenkins สร้าง CI credentials แบบ ephemeral และใช้ credential file ID `pawmap-runtime-env` สำหรับ staging ที่มี persistent database file ต้องประกอบด้วย runtime variables และ `POSTGRES_USER`/`POSTGRES_PASSWORD`

Pipeline ทำ source policy, dependency install, static checks, migration/seed, unit/integration, Playwright/axe/Lighthouse, audit/Trivy, image build, blue/green deploy, readiness/smoke และ rollback verification

ห้ามใช้ global Docker prune Cleanup ทำได้เฉพาะ resource ที่มี project/build label

ก่อน migration ต้องสร้าง `pg_dump` และเก็บ slot เดิมจน candidate ผ่าน smoke test

## 10. Security และ privacy

- ห้าม commit `.env*` ยกเว้น `.env.example`
- ห้าม commit password file, private key, database dump, logs, test screenshots, traces หรือ runtime uploads
- ห้ามบันทึก secret ลง command line, Jenkins console หรือ artifacts
- GitHub ใช้เก็บ source repository นี้เท่านั้น ห้ามใช้ Actions, Packages, GHCR, raw files หรือ release assets เป็น dependency/data source
- npm packages ต้อง resolve จาก npm registry ที่อนุญาต
- Commit author metadata เป็นการตั้งค่าของเจ้าของ repository ไม่ควรทำซ้ำในเอกสารหรือ source
- รักษา OSM และโมเดล 3D attribution ตามไฟล์ notice

## 11. Known limitations

- MinIO Community container tags เดิมไม่สามารถ pull แบบ anonymous ได้แล้ว ณ วันที่ 2026-10-21 และ MinIO AIStor image ต้องมี license จึงถอด bundled MinIO ออกจาก Compose ผู้รับงานต้องกำหนด S3-compatible provider ที่ได้รับอนุมัติก่อน deploy; production ไม่มี memory/filesystem fallback
- `PAWMAP_E2E_OBJECT_STORAGE=memory` ใช้ได้เฉพาะเมื่อ `CI=true` สำหรับ automated tests เท่านั้น ห้ามใช้เป็น runtime storage
- ยังไม่มี public domain และ TLS configuration
- ยังไม่มี production SMTP credentials
- ไม่มี production monitoring/alerting ภายนอก
- Repository ไม่มี user database และ uploaded media โดยตั้งใจ
- การทดสอบ map ถนนยังขึ้นกับเครือข่ายเมื่อไม่ได้ mock tiles
- ต้องตรวจ pinned container images อีกครั้งก่อน production rollout

## 12. Checklist ก่อนรับงานหรือ deploy

1. `git status` สะอาดและไม่มีไฟล์ลับถูก track
2. `npm run verify:release` ผ่าน
3. Snapshot checksum และจำนวน 3,091 ผ่าน
4. Migrations ใช้กับฐานใหม่ได้
5. ไม่มีบัญชี default หลัง reference seed/import
6. Admin ถูกสร้างด้วย password file ภายนอก repo
7. Tests/build/scans ผ่าน
8. Runtime secret file ถูกสร้างใน Jenkins Credentials
9. Backup/restore rehearsal ผ่าน
10. Domain, TLS, SMTP และ retention policy พร้อมก่อนเปิด public
