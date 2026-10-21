# แผนที่ถนนและประสิทธิภาพ

แผนที่ถนนใช้ MapLibre และ OpenStreetMap tiles เมื่อผู้ใช้เปิดโหมดถนน หมุดถูกวาดเป็น WebGL circles แทน HTML marker หลายพัน element

พฤติกรรมสำคัญ:

- โหลดสถานที่ตาม viewport และ debounce หลังลาก/ซูม
- ยกเลิก request เก่าและไม่ให้ response เก่าทับข้อมูลใหม่
- ไม่โหลดฉากไทย 3D เมื่อเปิดโหมดถนนโดยตรง
- หยุด polling/animation เมื่อ tab หรือ scene ถูกซ่อน
- หมุดพิกัดซ้อนเปิดรายการเลือกสถานที่
- รายการ keyboard แบ่งหน้า ไม่ render หลายพันปุ่มพร้อมกัน
- เมื่อ request ใหม่ล้มเหลวให้คงหมุดเดิมและแสดง Retry

ทดสอบที่ viewport 1440, 768 และ 390 พิกเซล พร้อม keyboard และ axe การวัด performance ต้องใช้จำนวนข้อมูลเท่ากันและ tiles จำลอง เพื่อแยกงานของแอปออกจากความเร็วเครือข่าย

คำสั่ง benchmark:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3002'
node scripts/benchmark-osm.mjs
```

ผล benchmark, screenshots และ traces เป็น test artifacts ห้าม commit ลง release repository
