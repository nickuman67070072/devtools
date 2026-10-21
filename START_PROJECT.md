# เปิด PawMap หลังเปิดเครื่องใหม่

คำสั่งทั้งหมดให้เริ่มจาก root ของ repository:

```powershell
Set-Location <PROJECT_ROOT>
```

## Development

1. เปิด Docker Desktop
2. ตรวจว่า `.env` มีค่าครบและไม่ถูกติดตามโดย Git
3. เปิด PostgreSQL, MinIO และ Mailpit ด้วย environment ภายนอก repository
4. Apply migration และ reference data
5. เริ่ม Next.js

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run places:import-public
npm run dev
```

เปิด <http://127.0.0.1:3000> และตรวจ <http://127.0.0.1:3000/api/health/ready>

`places:import-public` รันซ้ำได้โดยไม่สร้างสถานที่ซ้ำ หากมีข้อมูลครบแล้วสามารถข้ามขั้นตอนนี้ได้

## Local Docker host เดิม

หากใช้ container `devtools` ให้ mount repository เป็น `/workspace` และใช้ `.env` ที่อยู่นอก Git:

```powershell
docker start devtools
docker exec devtools docker info
powershell -ExecutionPolicy Bypass -File .\infra\scripts\dev-up.ps1
```

ห้ามสร้าง container ชื่อเดิมซ้ำ ห้ามใช้ global Docker prune และห้ามลบ volumes เพื่อแก้ปัญหา startup

## Jenkins

Jenkins ต้องได้รับ `JENKINS_ADMIN_ID`, `JENKINS_ADMIN_PASSWORD` และ credential file ID `pawmap-runtime-env` จากผู้ดูแล ห้ามใส่ค่าเหล่านี้ในคำสั่งหรือ Markdown

```powershell
docker exec devtools docker compose --env-file /workspace/.env -f /workspace/infra/jenkins/compose.yml up -d --build
```

Jenkins เปิดเฉพาะ loopback ที่ <http://127.0.0.1:8080>

## หาก Login ไม่ได้

- ตรวจ readiness และ PostgreSQL ก่อน
- ตรวจว่ามี Admin/User ที่สร้างอย่างตั้งใจ ไม่ใช้บัญชี default
- สร้าง Admin ด้วย `npm run admin:create -- <ADMIN_EMAIL> <EXTERNAL_PASSWORD_FILE>`
- ตรวจ Mailpit หรือ SMTP provider เมื่อทดสอบ reset password

รายละเอียด environment, data, tests และข้อจำกัดอยู่ใน [HANDOFF.md](HANDOFF.md)
