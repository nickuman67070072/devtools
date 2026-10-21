# PawMap Thailand

PawMap เป็นเว็บค้นหาสถานที่ที่ต้อนรับสัตว์เลี้ยงในประเทศไทย พัฒนาด้วย Next.js, TypeScript, Prisma และ PostgreSQL มีแผนที่ไทย 3D, แผนที่ถนน OpenStreetMap, ระบบส่งสถานที่ รีวิว รายงาน Favorites, Social Meetup, แชตกลุ่ม และเครื่องมือ Admin

Repository นี้เตรียมสำหรับส่งต่อผ่าน private source repository ไม่มี secret, บัญชีเริ่มต้น, backup ฐานข้อมูล หรือข้อมูลผู้ใช้รวมอยู่ใน Git

## เริ่มต้นอย่างปลอดภัย

ต้องใช้ Node.js `22.19.0` ขึ้นไป เพื่อให้ Next.js, Vitest และ Lighthouse ใช้ runtime เดียวกันโดยไม่มี engine mismatch

```powershell
Set-Location <PROJECT_ROOT>
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run places:import-public
```

กรอกค่าที่จำเป็นใน `.env` ก่อนรันคำสั่ง โดยสร้าง secret ใหม่สำหรับแต่ละ environment ห้ามนำค่าจากเครื่องอื่นหรือค่าในเอกสารเก่ากลับมาใช้

สร้าง Admin ครั้งแรกด้วยไฟล์รหัสผ่านที่อยู่นอก repository:

```powershell
npm run admin:create -- <ADMIN_EMAIL> <PASSWORD_FILE_OUTSIDE_REPOSITORY>
```

จากนั้นเริ่ม development server:

```powershell
npm run dev
```

เปิด <http://127.0.0.1:3000>

## ข้อมูลสถานที่ที่รวมมา

- Snapshot: `prisma/data/public-places.v1.json.gz`
- Manifest และ SHA-256: `prisma/data/public-places.manifest.json`
- จำนวน: 3,091 สถานที่, 16 หมวดหมู่, 77 จังหวัด และ 926 อำเภอ
- Snapshot ไม่มีบัญชีผู้ใช้ session รีวิว submission Meetup notification audit log หรือ import payload ดิบ

## Environment

`.env.example` เป็นรายการชื่อ variable เท่านั้น ค่าจริงต้องอยู่ใน `.env` หรือระบบจัดการ secret ภายนอก Git ตัวแปรหลักประกอบด้วย:

- Database และ Auth: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ORIGIN`
- Object storage ภายนอกที่รองรับ S3: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (repository ไม่ฝัง server image หรือ credentials)
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- Geocoding: `NOMINATIM_BASE_URL`, `NOMINATIM_CONTACT_EMAIL`

Production readiness จะไม่ผ่านหาก configuration สำคัญไม่ครบ และ production URL ภายนอกต้องใช้ HTTPS

## Verification

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

โครงการไม่ใช้ GitHub Actions, GitHub Packages, GHCR, raw files หรือ release assets เป็น dependency/data source ตัว private repository ใช้เก็บ source ของ PawMap เท่านั้น Jenkins ยังคงเป็น CI/CD หลัก

อ่านรายละเอียดทั้งหมดที่ [HANDOFF.md](HANDOFF.md) และวิธีเปิดระบบหลังเปิดเครื่องที่ [START_PROJECT.md](START_PROJECT.md)

## Attribution

แผนที่ถนนต้องแสดงเครดิต OpenStreetMap contributors และโมเดล 3D ต้องเก็บ notice ใน `public/models/` ไว้ตามใบอนุญาต Snapshot ขอบเขตจังหวัดยังตรวจสอบด้วย `public/data/boundaries/manifest.json`
