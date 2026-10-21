'use client';

import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { createCollection } from '@/features/user/actions';

export function CollectionCreator({ locale }: { locale: 'th' | 'en' }) {
  const [name, setName] = useState('');
  const router = useRouter();
  return (
    <form
      className="flex gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await createCollection(name);
        if (result.ok) {
          toast.success(locale === 'th' ? 'สร้างคอลเลกชันแล้ว' : 'Collection created');
          setName('');
          router.refresh();
        } else toast.error(result.formError);
      }}
    >
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        minLength={2}
        maxLength={80}
        placeholder={locale === 'th' ? 'ชื่อคอลเลกชันใหม่' : 'New collection name'}
        required
      />
      <Button type="submit" className="shrink-0">
        <FolderPlus className="size-4" />
        {locale === 'th' ? 'สร้าง' : 'Create'}
      </Button>
    </form>
  );
}
