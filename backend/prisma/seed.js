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

  // Create a sample quiz
  const quiz = await prisma.quiz.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: '一般知識測驗',
      description: '測試你的一般知識！',
      isPublic: true,
      createdById: admin.id,
      questions: {
        create: [
          {
            order: 1,
            text: '地球是太陽系第幾顆行星？',
            timeLimit: 20,
            points: 1000,
            options: {
              create: [
                { text: '第二顆', isCorrect: false, order: 0 },
                { text: '第三顆', isCorrect: true, order: 1 },
                { text: '第四顆', isCorrect: false, order: 2 },
                { text: '第五顆', isCorrect: false, order: 3 },
              ],
            },
          },
          {
            order: 2,
            text: '世界上最高的山是哪座？',
            timeLimit: 20,
            points: 1000,
            options: {
              create: [
                { text: 'K2', isCorrect: false, order: 0 },
                { text: '馬特洪峰', isCorrect: false, order: 1 },
                { text: '聖母峰', isCorrect: true, order: 2 },
                { text: '乞力馬扎羅山', isCorrect: false, order: 3 },
              ],
            },
          },
          {
            order: 3,
            text: '台灣的首都是哪裡？',
            timeLimit: 15,
            points: 1000,
            options: {
              create: [
                { text: '台中', isCorrect: false, order: 0 },
                { text: '台南', isCorrect: false, order: 1 },
                { text: '高雄', isCorrect: false, order: 2 },
                { text: '台北', isCorrect: true, order: 3 },
              ],
            },
          },
          {
            order: 4,
            text: '水的化學式是什麼？',
            timeLimit: 15,
            points: 1000,
            options: {
              create: [
                { text: 'H2O2', isCorrect: false, order: 0 },
                { text: 'CO2', isCorrect: false, order: 1 },
                { text: 'H2O', isCorrect: true, order: 2 },
                { text: 'NaCl', isCorrect: false, order: 3 },
              ],
            },
          },
          {
            order: 5,
            text: '1 + 1 等於多少？',
            timeLimit: 10,
            points: 500,
            options: {
              create: [
                { text: '1', isCorrect: false, order: 0 },
                { text: '2', isCorrect: true, order: 1 },
                { text: '3', isCorrect: false, order: 2 },
                { text: '11', isCorrect: false, order: 3 },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`Created sample quiz: ${quiz.title}`);
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
