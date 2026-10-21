import nodemailer from 'nodemailer';
import { requiredEnvironment } from '@/lib/server-config';

function mailTransport() {
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  if (Boolean(user) !== Boolean(password))
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  return nodemailer.createTransport({
    host: requiredEnvironment('SMTP_HOST'),
    port: Number(requiredEnvironment('SMTP_PORT')),
    secure: process.env.SMTP_SECURE === 'true',
    auth: user && password ? { user, pass: password } : undefined,
  });
}

export async function sendPasswordResetEmail({
  email,
  name,
  url,
}: {
  email: string;
  name: string;
  url: string;
}) {
  await mailTransport().sendMail({
    from: requiredEnvironment('MAIL_FROM'),
    to: email,
    subject: 'รีเซ็ตรหัสผ่าน PawMap Thailand / Reset your password',
    text: `สวัสดี ${name}\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:\n${url}\n\nหากคุณไม่ได้ส่งคำขอนี้ สามารถละเว้นอีเมลฉบับนี้ได้`,
    html: `<div style="font-family:sans-serif;line-height:1.7"><h2>PawMap Thailand</h2><p>สวัสดี ${escapeHtml(name)}</p><p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์มีอายุจำกัด</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#147d69;color:white;text-decoration:none">ตั้งรหัสผ่านใหม่</a></p><p>If you did not request this email, you can ignore it.</p></div>`,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
