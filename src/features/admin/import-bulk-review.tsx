'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewImport } from './import-actions';

export function ImportBulkReview({
  rows,
}: {
  rows: { id: string; version: number; name: string; warnings: string[] }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, start] = useTransition();
  const router = useRouter();
  function approve() {
    if (
      !selected.length ||
      !window.confirm(
        `ยืนยันว่าได้ตรวจข้อมูลทั้ง ${selected.length} รายการแล้ว? รายการไม่ครบหรือซ้ำจะไม่ถูกเผยแพร่`,
      )
    )
      return;
    start(async () => {
      const results: string[] = [];
      for (const row of rows.filter((item) => selected.includes(item.id)).slice(0, 50)) {
        const result = await reviewImport({
          id: row.id,
          version: row.version,
          decision: 'APPROVE',
        });
        results.push(`${row.name}: ${result.ok ? 'อนุมัติแล้ว' : result.formError}`);
        setMessages([...results]);
      }
      setSelected([]);
      router.refresh();
    });
  }
  return (
    <section className="mb-5 rounded-xl border bg-white p-4">
      <h2 className="font-bold">อนุมัติรายการที่ตรวจแล้ว (สูงสุด 50 รายการ)</h2>
      <p className="mt-2 text-sm">
        เปิดรายละเอียดเพื่อตรวจต้นทางก่อนเลือก รายการที่มีคำเตือนควรแก้ไขเป็นรายรายการ
      </p>
      <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3">
            <label>
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.includes(row.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, row.id]
                      : selected.filter((id) => id !== row.id),
                  )
                }
              />
              <span className="ml-2">{row.name}</span>
            </label>
            <Link className="shrink-0 underline" href={'/admin/imports/' + row.id}>
              ตรวจข้อมูล
            </Link>
          </div>
        ))}
      </div>
      <button
        disabled={busy || !selected.length}
        onClick={approve}
        className="mt-4 rounded-lg border px-4 py-2 disabled:opacity-50"
      >
        {busy ? 'กำลังตรวจและบันทึก…' : `อนุมัติที่เลือก (${selected.length})`}
      </button>
      <div role="status" className="mt-3 max-h-52 overflow-y-auto text-sm">
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </div>
    </section>
  );
}
