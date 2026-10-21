'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { updateCategory, updateProvince } from '@/features/admin/actions';

export function ReferenceEditor({
  item,
  type,
}: {
  item: { id: string; code: string; nameTh: string; nameEn: string; isActive?: boolean };
  type: 'province' | 'category';
}) {
  const [nameTh, setNameTh] = useState(item.nameTh);
  const [nameEn, setNameEn] = useState(item.nameEn);
  const [isActive, setIsActive] = useState(item.isActive ?? true);
  const [pending, setPending] = useState(false);
  async function save() {
    setPending(true);
    const result =
      type === 'category'
        ? await updateCategory({ id: item.id, nameTh, nameEn, isActive })
        : await updateProvince({ id: item.id, nameTh, nameEn });
    setPending(false);
    if (result.ok) toast.success('บันทึกแล้ว');
    else toast.error(result.formError);
  }
  return (
    <tr className="border-t border-[#e7e5df]">
      <td className="p-3 font-mono text-xs">{item.code}</td>
      <td className="p-2">
        <Input
          value={nameTh}
          onChange={(event) => setNameTh(event.target.value)}
          aria-label={`ชื่อไทย ${item.code}`}
        />
      </td>
      <td className="p-2">
        <Input
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
          aria-label={`English name ${item.code}`}
        />
      </td>
      {type === 'category' && (
        <td className="p-3">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Active
          </label>
        </td>
      )}
      <td className="p-3 text-right">
        <Button size="sm" variant="secondary" onClick={() => void save()} disabled={pending}>
          <Save className="size-4" />
          บันทึก
        </Button>
      </td>
    </tr>
  );
}
