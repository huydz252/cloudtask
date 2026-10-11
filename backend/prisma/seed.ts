import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const db = new PrismaClient();
async function seed() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 8 || Buffer.byteLength(password) > 72) throw new Error('Set SEED_PASSWORD (8 characters minimum, 72 bytes maximum).');
  const email = (process.env.SEED_EMAIL || 'demo@cloudtask.local').toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  const user = existing ?? await db.user.create({ data: { email, fullName: 'CloudTask Demo', passwordHash: await bcrypt.hash(password, 12) } });
  const project = await db.project.findUnique({ where: { key: 'DEMO' } });
  if (project) { console.log('DEMO project already exists; existing data was preserved.'); return; }
  await db.project.create({ data: { title: 'Ra mắt CloudTask', key: 'DEMO', description: 'Dự án mẫu để trải nghiệm Kanban, phân công và bình luận.', members: { create: { userId: user.id, role: 'ADMIN' } }, tasks: { create: [
    { title: 'Chuẩn bị môi trường AWS', description: 'Tạo VPC, RDS và bucket S3 riêng tư.', priority: 'HIGH', creatorId: user.id, assigneeId: user.id, dueDate: new Date(Date.now() + 7 * 86400000) },
    { title: 'Kiểm thử bảng Kanban', description: 'Kéo thả công việc giữa các cột và thử bộ lọc.', status: 'IN_PROGRESS', priority: 'URGENT', creatorId: user.id, assigneeId: user.id },
    { title: 'Hoàn thành thiết kế dữ liệu', status: 'DONE', priority: 'MEDIUM', creatorId: user.id },
  ] } } });
  console.log(`Seed ready: ${email}. Password comes from your SEED_PASSWORD; it is never printed.`);
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
