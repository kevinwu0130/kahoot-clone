const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@1234', 10);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@kahoot.com'
  const adminName = process.env.ADMIN_NAME || '管理員'

  // Remove old default admin account if it exists
  await prisma.user.deleteMany({ where: { email: 'admin@kahoot.com' } }).catch(() => {})

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, password: hashedPassword },
    create: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  // One-time cleanup: earlier this seed created a sample quiz "一般知識測驗"
  // on every deploy (its upsert matched on id:1, which never matched the real
  // auto-incremented id), producing many duplicates. Remove them all here.
  // Wrapped so a failure never aborts startup (start.sh runs with `set -e`).
  try {
    const samples = await prisma.quiz.findMany({
      where: { title: '一般知識測驗' },
      select: { id: true },
    });
    const sampleIds = samples.map((s) => s.id);
    if (sampleIds.length) {
      const games = await prisma.game.findMany({
        where: { quizId: { in: sampleIds } },
        select: { id: true },
      });
      const gameIds = games.map((g) => g.id);
      if (gameIds.length) {
        await prisma.gameAnswer.deleteMany({ where: { gameId: { in: gameIds } } });
        await prisma.player.deleteMany({ where: { gameId: { in: gameIds } } });
        await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
      }
      // questions + options cascade-delete with the quiz
      const removed = await prisma.quiz.deleteMany({ where: { id: { in: sampleIds } } });
      console.log(`Removed ${removed.count} duplicate sample quizzes`);
    }
  } catch (e) {
    console.error('Sample-quiz cleanup skipped:', e.message);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
