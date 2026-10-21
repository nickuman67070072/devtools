import { AdminShell } from '@/features/admin/admin-shell';
import { UserAction } from '@/features/admin/user-action';
import { prisma } from '@/lib/prisma';

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <AdminShell
      title="จัดการผู้ใช้"
      description="ระงับบัญชีจะ revoke session ทั้งหมดทันที และ protected API ตรวจซ้ำฝั่ง server"
    >
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#e7efe9]">
            <tr>
              <th className="p-4">ผู้ใช้</th>
              <th>อีเมล</th>
              <th>Role</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[#e7e5df]">
                <td className="p-4 font-bold">{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.suspendedAt ? 'SUSPENDED' : 'ACTIVE'}</td>
                <td className="p-3 text-right">
                  <UserAction id={user.id} suspended={Boolean(user.suspendedAt)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
