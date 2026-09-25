/**
 * Seed тренировочной платформы VOXY.
 *
 * Все задания, отзывы и суммы — виртуальные (игровая валюта внутри приложения).
 * Никаких реальных отзывов, публикаций или выплат.
 *
 * Запуск: npx prisma db seed
 */
import { prisma } from "../lib/prisma";
import { provisionDemoUser } from "../lib/demo-user";
import { INITIAL_PARTICIPANTS, INITIAL_TOTAL_BONUSES } from "../lib/app-stats-defaults";
import { createSeededRandom, generateMockProfile } from "../lib/mock-users";
import { startOfToday } from "../lib/dates";

interface MockUser {
  telegramId: string;
  username: string;
  firstName: string;
  lastName: string;
  totalEarned: number;
  completedTasks: number;
}

/** 16 «заметных» участников — фиксированные данные (стабильный вид ТОП-30). */
const FEATURED_MOCK_USERS: MockUser[] = [
  { telegramId: "900000001", username: "Rappthbx", firstName: "Артём", lastName: "Кравцов", totalEarned: 28940, completedTasks: 74 },
  { telegramId: "900000002", username: "krezx1", firstName: "Кирилл", lastName: "Ерёмин", totalEarned: 26780, completedTasks: 68 },
  { telegramId: "900000003", username: "milotonina", firstName: "Милана", lastName: "Тонина", totalEarned: 24560, completedTasks: 61 },
  { telegramId: "900000004", username: "rogov12_45", firstName: "Дмитрий", lastName: "Рогов", totalEarned: 21130, completedTasks: 55 },
  { telegramId: "900000005", username: "Спайпер", firstName: "Сергей", lastName: "Папин", totalEarned: 18760, completedTasks: 49 },
  { telegramId: "900000006", username: "vitaly_ry", firstName: "Виталий", lastName: "Рыбаков", totalEarned: 16240, completedTasks: 42 },
  { telegramId: "900000007", username: "morozova_ann", firstName: "Анна", lastName: "Морозова", totalEarned: 14890, completedTasks: 38 },
  { telegramId: "900000008", username: "danil_k", firstName: "Данил", lastName: "Ковалёв", totalEarned: 12340, completedTasks: 33 },
  { telegramId: "900000009", username: "nastya_v", firstName: "Анастасия", lastName: "Волкова", totalEarned: 10760, completedTasks: 29 },
  { telegramId: "900000010", username: "petrov_p", firstName: "Пётр", lastName: "Петров", totalEarned: 9120, completedTasks: 25 },
  { telegramId: "900000011", username: "kirill_99", firstName: "Кирилл", lastName: "Соколов", totalEarned: 7840, completedTasks: 21 },
  { telegramId: "900000012", username: "lyosha_m", firstName: "Алексей", lastName: "Медведев", totalEarned: 6320, completedTasks: 18 },
  { telegramId: "900000013", username: "ivanova_olga", firstName: "Ольга", lastName: "Иванова", totalEarned: 5180, completedTasks: 15 },
  { telegramId: "900000014", username: "shadowfox", firstName: "Максим", lastName: "Лебедев", totalEarned: 4260, completedTasks: 12 },
  { telegramId: "900000015", username: "orlova_k", firstName: "Ксения", lastName: "Орлова", totalEarned: 3140, completedTasks: 9 },
  { telegramId: "900000016", username: "zaharov", firstName: "Егор", lastName: "Захаров", totalEarned: 2210, completedTasks: 7 },
];

/**
 * Остальные demo-участники генерируются ДЕТЕРМИНИРОВАННО (фиксированный seed),
 * поэтому повторный seed не перемешивает рейтинг:
 *  - ~82 участника в среднем диапазоне (500…2 000 ₽);
 *  - 12 участников ниже уровня демо-пользователя (60…340 ₽) — благодаря им реальный
 *    пользователь оказывается примерно в нижней части рейтинга (~90-110 из ~110).
 */
const MID_TIER_COUNT = 82;
const LOW_TIER_COUNT = 12;

function buildMockUsers(): MockUser[] {
  const random = createSeededRandom(20260924);
  const users: MockUser[] = [...FEATURED_MOCK_USERS];

  for (let index = 0; index < MID_TIER_COUNT + LOW_TIER_COUNT; index += 1) {
    const isLowTier = index >= MID_TIER_COUNT;
    users.push(
      generateMockProfile(random, {
        telegramId: `9100${String(index + 1).padStart(6, "0")}`,
        totalEarned: isLowTier ? random.int(60, 340) : random.int(500, 2_000),
      }),
    );
  }

  return users;
}

const MOCK_USERS: MockUser[] = buildMockUsers();

interface SeedTask {
  id: string;
  icon: string;
  title: string;
  description: string;
  conditions: string;
  virtualTarget: string;
  type: "REVIEW_SIMULATION" | "PRODUCT_FEEDBACK" | "SERVICE_FEEDBACK" | "TELEGRAM_SUBSCRIPTION";
  reward: number;
  minLength: number;
  requiresRating: boolean;
  options: string[];
}

/** Задания платформы. Первое — подписка на Telegram-каналы (проверка на backend). */
const TASKS: SeedTask[] = [
  {
    id: "task-telegram-subscription",
    icon: "✈️",
    title: "Подписка на Telegram-каналы",
    description:
      "Подпишитесь на 3 Telegram-канала и отправьте заявки на вступление. После проверки подписок задание будет засчитано.",
    conditions:
      "Подпишитесь на 3 Telegram-канала и отправьте заявки на вступление. После проверки подписок задание будет засчитано.",
    virtualTarget: "Telegram-каналы",
    type: "TELEGRAM_SUBSCRIPTION",
    reward: 330,
    minLength: 1,
    requiresRating: false,
    options: [],
  },
  {
    id: "task-restaurant",
    icon: "🍽",
    title: "Отзыв о ресторане",
    description: "Напишите тренировочный отзыв о виртуальном ресторане.",
    conditions:
      "Напишите виртуальный отзыв минимум на 25 символов. Опишите атмосферу и кухню условного ресторана.",
    virtualTarget: "ресторан",
    type: "SERVICE_FEEDBACK",
    reward: 420,
    minLength: 25,
    requiresRating: true,
    options: ["Кухня на высоте, обязательно вернусь", "Вкусно, но ждали заказ долго", "Уютно и приятный персонал"],
  },
  {
    id: "task-product",
    icon: "🎧",
    title: "Отзыв о товаре",
    description: "Напишите тренировочный отзыв о виртуальной покупке.",
    conditions:
      "Напишите виртуальный отзыв минимум на 30 символов. Расскажите о качестве условного товара и доставке.",
    virtualTarget: "магазин электроники",
    type: "PRODUCT_FEEDBACK",
    reward: 500,
    minLength: 30,
    requiresRating: true,
    options: ["Звук отличный, шумоподавление работает", "Качество хорошее за свои деньги", "Пришли быстро, упаковка целая"],
  },
];

/** Дедлайн «до 23:59» сегодня, а если уже позже — завтра. */
function resolveDeadline(): Date {
  const deadline = new Date();
  deadline.setHours(23, 59, 0, 0);
  if (deadline.getTime() <= Date.now()) {
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(23, 59, 0, 0);
  }
  return deadline;
}

async function main(): Promise<void> {
  const deadline = resolveDeadline();

  // 1. Демо-пользователь локальной разработки: Игорь Рябов, @demo_user, 360 ₽.
  const demoUser = await provisionDemoUser();

  // 2. Участники рейтинга: demo-боты (isMock = true) — им начисляются ежедневные прибавки.
  for (const mock of MOCK_USERS) {
    const balance = Math.round(mock.totalEarned * 0.22);
    const profile = {
      username: mock.username,
      firstName: mock.firstName,
      lastName: mock.lastName,
      balance,
      totalEarned: mock.totalEarned,
      completedTasks: mock.completedTasks,
      isMock: true,
    };

    await prisma.user.upsert({
      where: { telegramId: mock.telegramId },
      update: profile,
      create: { telegramId: mock.telegramId, ...profile },
    });
  }

  // 3. Задания и варианты ответов.
  for (const task of TASKS) {
    const { options, ...taskData } = task;
    await prisma.task.upsert({
      where: { id: task.id },
      update: { ...taskData, status: "ACTIVE", deadline },
      create: { ...taskData, status: "ACTIVE", deadline, requiresModeration: false },
    });

    if (options.length === 0) {
      // У заданий без вариантов ответа (например, подписка на каналы) их быть не должно.
      await prisma.taskOption.deleteMany({ where: { taskId: task.id } });
      continue;
    }

    for (const [index, text] of options.entries()) {
      const optionId = `${task.id}-option-${index + 1}`;
      await prisma.taskOption.upsert({
        where: { id: optionId },
        update: { text, order: index, taskId: task.id },
        create: { id: optionId, taskId: task.id, text, order: index },
      });
    }
  }

  // 3.1. Одноразовая чистка: первым заданием раньше был «Отзыв о цветочном магазине».
  //      Удаляем только если по нему нет выполнений (чтобы не терять данные).
  const legacyTask = await prisma.task.findUnique({
    where: { id: "task-flowers" },
    include: { _count: { select: { submissions: true } } },
  });
  if (legacyTask && legacyTask._count.submissions === 0) {
    await prisma.task.delete({ where: { id: legacyTask.id } });
  }

  const [usersCount, tasksCount, optionsCount, submissionsCount] = await Promise.all([
    prisma.user.count(),
    prisma.task.count(),
    prisma.taskOption.count(),
    prisma.taskSubmission.count(),
  ]);

  // 4. Ежедневная статистика: стартовая запись создаётся только при первом запуске
  //    и НИКОГДА не перезаписывается (иначе сбросится накопленный прирост).
  let appStats = await prisma.appStats.findFirst({ orderBy: { date: "desc" } });
  if (!appStats) {
    appStats = await prisma.appStats.create({
      data: {
        date: startOfToday(),
        participantsCount: INITIAL_PARTICIPANTS,
        totalBonuses: INITIAL_TOTAL_BONUSES,
      },
    });
  }

  console.log("Seed завершён (виртуальные данные):");
  console.log(`  демо-пользователь: ${demoUser.firstName} ${demoUser.lastName} (@${demoUser.username}) — ${demoUser.balance} ₽`);
  console.log(`  пользователей: ${usersCount}`);
  console.log(`  заданий: ${tasksCount}, вариантов ответов: ${optionsCount}`);
  console.log(`  выполненных заданий: ${submissionsCount}`);
  console.log(`  статистика (${appStats.date.toISOString().slice(0, 10)}): ${appStats.participantsCount} участников, ${appStats.totalBonuses} бонусов`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Seed упал с ошибкой:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

