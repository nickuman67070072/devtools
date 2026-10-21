# แก้โค้ดแล้วทำให้แสดงบนหน้าเว็บ

## ดูผลระหว่างพัฒนา

เริ่มจาก `<PROJECT_ROOT>` แล้วรัน:

```powershell
npm run dev
```

Next.js จะอัปเดตหน้าเว็บอัตโนมัติเมื่อแก้ source หากแก้ Prisma schema ให้สร้าง migration และ regenerate client ก่อน หากแก้ environment ให้ restart dev server

```powershell
npm run db:generate
npm run db:migrate
```

## ตรวจงานก่อนส่ง

```powershell
npm run verify:release
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```

ห้าม commit `.env`, password file, database dump, deploy log, screenshots จากการทดสอบ หรือ object-storage data

## Jenkins และ staging

Jenkins checkout source แล้วสร้าง environment ทดสอบแบบ ephemeral ส่วน deploy ใช้ credential file `pawmap-runtime-env` ที่ผู้ดูแลสร้างใน Jenkins Credentials

เมื่อ build ผ่าน Jenkins จะ build standalone image, scan, deploy แบบ blue/green, ตรวจ readiness/smoke และ rollback อัตโนมัติเมื่อ candidate ไม่ผ่าน

การแก้ source แล้ว refresh หน้า staging จะไม่เห็นผลจนกว่าจะ commit และรัน pipeline ใหม่ Development server และ staging เป็นคนละ process

## ตรวจว่ากำลังดูระบบใด

- Development: terminal มี `next dev`
- Production preview: terminal มี `next start` หรือ standalone `server.js`
- Staging: request ผ่าน Nginx และ container slot blue/green

อย่าหยุด process หรือ container ที่ไม่ทราบเจ้าของ ตรวจพอร์ตและชื่อ container ก่อนทุกครั้ง
