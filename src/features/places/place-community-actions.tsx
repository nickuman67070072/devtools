'use client';

import { BadgeCheck, Flag, Heart, MessageSquareText, Star, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/field';
import { reportPlace, saveReview, toggleFavorite, verifyPlace } from '@/features/community/actions';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

export function PlaceCommunityActions({
  placeId,
  placeSlug,
  locale,
  signedIn,
  initialFavorite = false,
}: {
  placeId: string;
  placeSlug: string;
  locale: Locale;
  signedIn: boolean;
  initialFavorite?: boolean;
}) {
  const isThai = locale === 'th';
  const reportDialog = useRef<HTMLDialogElement>(null);
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);
  const [rating, setRating] = useState(5);
  const actionClass =
    'inline-flex min-h-11 min-w-max shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--forest)] transition hover:border-[var(--forest-bright)] hover:bg-[var(--forest-soft)] sm:flex-1';
  const returnPath = withLocale(locale, `/places/${placeSlug}`);
  const loginHref = `${withLocale(locale, '/login')}?next=${encodeURIComponent(returnPath)}`;
  const guestActions = [
    { Icon: Heart, label: isThai ? 'บันทึก' : 'Save', tone: '' },
    {
      Icon: BadgeCheck,
      label: isThai ? 'ยืนยันว่าข้อมูลถูกต้อง' : 'Confirm details',
      tone: '',
    },
    { Icon: MessageSquareText, label: isThai ? 'เขียนรีวิว' : 'Write a review', tone: '' },
    {
      Icon: Flag,
      label: isThai ? 'รายงานข้อมูลไม่ถูกต้อง' : 'Report incorrect data',
      tone: 'text-[var(--terracotta)]',
    },
  ];
  if (!signedIn)
    return (
      <div
        className="flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
        role="group"
        aria-label={isThai ? 'การมีส่วนร่วมกับสถานที่' : 'Place actions'}
      >
        {guestActions.map(({ Icon, label, tone }) => (
          <a key={label} href={loginHref} className={`${actionClass} ${tone}`}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </a>
        ))}
      </div>
    );
  async function favoritePlace() {
    setPending(true);
    const result = await toggleFavorite(placeId);
    setPending(false);
    if (result.ok) {
      setFavorite(result.data.active);
      toast.success(
        result.data.active ? (isThai ? 'บันทึกแล้ว' : 'Saved') : isThai ? 'นำออกแล้ว' : 'Removed',
      );
    } else toast.error(result.formError);
  }
  async function submitReport(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    const result = await reportPlace(
      placeId,
      String(data.get('reason')) as 'INCORRECT_INFORMATION',
      String(data.get('details')),
    );
    setPending(false);
    if (result.ok) {
      toast.success(isThai ? 'ส่งรายงานแล้ว' : 'Report sent');
      reportDialog.current?.close();
      form.reset();
    } else
      toast.error(
        result.formError ??
          Object.values(result.fieldErrors ?? {})
            .flat()
            .join(', '),
      );
  }
  async function submitReview(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    const result = await saveReview({
      placeId,
      rating,
      cleanlinessRating: rating,
      convenienceRating: rating,
      petFriendlinessRating: rating,
      content: String(data.get('content')),
      imageKeys: [],
    });
    setPending(false);
    if (result.ok) {
      toast.success(isThai ? 'บันทึกรีวิวแล้ว' : 'Review saved');
      reviewDialog.current?.close();
      form.reset();
    } else
      toast.error(
        result.formError ??
          Object.values(result.fieldErrors ?? {})
            .flat()
            .join(', '),
      );
  }
  return (
    <>
      <div
        className="flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
        role="group"
        aria-label={isThai ? 'การมีส่วนร่วมกับสถานที่' : 'Place actions'}
      >
        <Button
          variant="secondary"
          className="min-w-max shrink-0 whitespace-nowrap sm:flex-1"
          onClick={() => void favoritePlace()}
          disabled={pending}
        >
          <Heart className={`size-4 ${favorite ? 'fill-current' : ''}`} />
          {favorite ? (isThai ? 'บันทึกแล้ว' : 'Saved') : isThai ? 'บันทึก' : 'Save'}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            setPending(true);
            const result = await verifyPlace(placeId, 'ยืนยันจากหน้ารายละเอียดสถานที่');
            setPending(false);
            if (result.ok)
              toast.success(
                `${isThai ? 'ยืนยันแล้ว คะแนน' : 'Verified, score'} ${result.data.score}`,
              );
            else toast.error(result.formError);
          }}
          disabled={pending}
          className="min-w-max shrink-0 whitespace-nowrap sm:flex-1"
        >
          <BadgeCheck className="size-4" />
          {isThai ? 'ยืนยันว่าข้อมูลถูกต้อง' : 'Confirm details'}
        </Button>
        <Button
          variant="secondary"
          className="min-w-max shrink-0 whitespace-nowrap sm:flex-1"
          onClick={() => reviewDialog.current?.showModal()}
        >
          <MessageSquareText className="size-4" />
          {isThai ? 'เขียนรีวิว' : 'Write a review'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => reportDialog.current?.showModal()}
          className="min-w-max shrink-0 whitespace-nowrap text-[var(--terracotta)] sm:flex-1"
        >
          <Flag className="size-4" />
          {isThai ? 'รายงานข้อมูลไม่ถูกต้อง' : 'Report incorrect data'}
        </Button>
      </div>
      <dialog
        ref={reviewDialog}
        className="m-auto w-[min(520px,calc(100%-32px))] rounded-[26px] border-0 p-0 shadow-2xl backdrop:bg-[#181c1a]/50"
      >
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submitReview(event.currentTarget);
          }}
        >
          <div className="flex justify-between">
            <h2 className="text-2xl font-black">{isThai ? 'รีวิวสถานที่' : 'Review this place'}</h2>
            <button type="button" onClick={() => reviewDialog.current?.close()} aria-label="Close">
              <X />
            </button>
          </div>
          <div className="mt-5 flex gap-2" role="group" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setRating(value)}
                aria-label={`${value} stars`}
              >
                <Star
                  className={`size-8 text-[#d08a28] ${value <= rating ? 'fill-current' : ''}`}
                />
              </button>
            ))}
          </div>
          <label className="mt-5 grid gap-1.5 text-sm font-bold">
            {isThai ? 'ประสบการณ์ของคุณ' : 'Your experience'}
            <Textarea name="content" required minLength={10} maxLength={2000} rows={5} />
          </label>
          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={pending}>
              {isThai ? 'ส่งรีวิว' : 'Submit review'}
            </Button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={reportDialog}
        className="m-auto w-[min(520px,calc(100%-32px))] rounded-[26px] border-0 p-0 shadow-2xl backdrop:bg-[#181c1a]/50"
      >
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submitReport(event.currentTarget);
          }}
        >
          <div className="flex justify-between">
            <h2 className="text-2xl font-black">{isThai ? 'รายงานข้อมูล' : 'Report data'}</h2>
            <button type="button" onClick={() => reportDialog.current?.close()} aria-label="Close">
              <X />
            </button>
          </div>
          <label className="mt-5 grid gap-1.5 text-sm font-bold">
            {isThai ? 'เหตุผล' : 'Reason'}
            <Select name="reason">
              <option value="INCORRECT_INFORMATION">
                {isThai ? 'ข้อมูลไม่ถูกต้อง' : 'Incorrect information'}
              </option>
              <option value="TEMPORARILY_CLOSED">
                {isThai ? 'ปิดชั่วคราว' : 'Temporarily closed'}
              </option>
              <option value="PERMANENTLY_CLOSED">
                {isThai ? 'ปิดกิจการ' : 'Permanently closed'}
              </option>
              <option value="DUPLICATE">{isThai ? 'ข้อมูลซ้ำ' : 'Duplicate'}</option>
              <option value="OTHER">{isThai ? 'อื่น ๆ' : 'Other'}</option>
            </Select>
          </label>
          <label className="mt-4 grid gap-1.5 text-sm font-bold">
            {isThai ? 'รายละเอียด' : 'Details'}
            <Textarea name="details" required minLength={10} maxLength={1000} rows={4} />
          </label>
          <div className="mt-5 flex justify-end">
            <Button type="submit" variant="danger" disabled={pending}>
              {isThai ? 'ส่งรายงาน' : 'Send report'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
