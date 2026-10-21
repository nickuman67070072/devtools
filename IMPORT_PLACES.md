# ข้อมูลสถานที่และการนำเข้า

## Snapshot สำหรับส่งต่อ

ข้อมูลสาธารณะที่อนุมัติแล้วอยู่ที่:

- `prisma/data/public-places.v1.json.gz`
- `prisma/data/public-places.manifest.json`

นำเข้าหลัง migrate และ reference seed:

```powershell
npm run db:migrate
npm run db:seed
npm run places:import-public
```

Importer ตรวจ SHA-256, schema, จำนวนหมวด และ reference codes ก่อนเขียน พร้อม upsert ด้วย slug/stable identifier จึงรันซ้ำได้

Snapshot ไม่มีข้อมูลผู้ใช้ รีวิว Meetup audit log import queue หรือ URL provenance ดิบ

## สร้าง snapshot ใหม่

ใช้เฉพาะฐานข้อมูลสำเนาที่ตรวจแล้ว ห้าม export จาก production โดยตรง:

```powershell
$env:DATABASE_URL = '<SANITIZED_DATABASE_URL>'
npm run places:export-public
npm run verify:release
```

Exporter จะหยุดหากจำนวน public places ไม่ใช่ 3,091 ห้ามแก้ตัวเลขตรวจรับเพื่อให้ไฟล์ที่ผิดผ่านโดยไม่ทบทวนข้อมูล

## การนำเข้าชุดข้อมูลภายนอก

เครื่องมือนำเข้าดิบมีไว้สำหรับ Admin review queue เท่านั้น:

```powershell
npm run places:import -- <IMPORT_FILE>
```

ห้าม commit ไฟล์ต้นฉบับ, raw payload, path เครื่อง, download URL หรือข้อมูลที่ยังไม่ได้ตรวจสิทธิ์เผยแพร่
