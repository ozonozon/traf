# VOXY — платформа заданий (Telegram Mini App)

> **Это игровой / тренировочный симулятор платформы заданий.**
> Все задания, отзывы, ответы, оценки и рубли — **виртуальные**.
> Пользователь не публикует реальные отзывы, не взаимодействует с Яндекс Картами,
> Google Maps и маркетплейсами, не получает реальных денег и не совершает
> никаких финансовых операций. Все `₽` — внутриигровая валюта приложения.

## Что внутри

Три раздела: **Задания** (`/tasks`), **Топ** (`/top`), **Профиль** (`/profile`).

Механика: открыть задание → выбрать готовый вариант ответа или написать свой текст →
поставить оценку 1–5 → «Выполнить задание» → сервер атомарно начисляет виртуальное
вознаграждение → обновляются баланс, история операций, профиль и рейтинг.

## Стек

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 (дизайн-токены в `app/globals.css` через CSS variables)
- **Prisma 7.10 + PostgreSQL** (driver adapter `@prisma/adapter-pg` / `pg`), production — Neon
- Zod (валидация), lucide-react (иконки), Telegram WebApp API

## Быстрый старт

```bash
npm install                # также сгенерирует Prisma Client (postinstall)

# 1. Локальный Postgres (та же СУБД, что в production — Neon)
docker run --name voxy-postgres \
  -e POSTGRES_USER=voxy -e POSTGRES_PASSWORD=voxy_local_password -e POSTGRES_DB=voxy \
  -p 5433:5432 -d postgres:16

# 2. Переменные окружения
cp .env.example .env
#   DATABASE_URL="postgresql://voxy:voxy_local_password@localhost:5433/voxy?schema=public"
#   (или строка Neon из панели Neon для локальной работы с реальной базой)

# 3. Схема и демо-данные
npm run db:deploy          # применит миграции (prisma migrate deploy)
npm run db:seed            # 3 задания + демо-пользователь + 110 участников рейтинга

npm run dev                # http://localhost:3000
```

### Переменные окружения (`.env`)

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | строка подключения PostgreSQL (локально свой Postgres, в production — Neon; читается только сервером) |
| `TELEGRAM_BOT_TOKEN` | токен бота из @BotFather. **Только сервер**, на фронтенд не попадает |
| `AUTH_SECRET` | подпись httpOnly-сессии (`openssl rand -hex 32`), в production обязателен |
| `ADMIN_TOKEN` | доступ к заготовке админ-API (если не задан — админ-роуты отвечают 503) |

> Секретов с префиксом `NEXT_PUBLIC_` в проекте нет и быть не должно: такие переменные
> попадают в клиентский бандл.

### База данных только на сервере

- Весь доступ к БД идёт через **один слой**: `lib/db.ts` (помечен `import "server-only"`).
  Его нельзя импортировать из клиентского компонента — сборка упадёт с понятной ошибкой.
- Клиентские компоненты вообще не знают о Prisma: они общаются только с API-роутами.
- Публичных DB-эндпоинтов, страниц просмотра таблиц и Prisma Studio в проде нет.
  Заготовка админ-API (`/api/admin/*`) включается только при заданном `ADMIN_TOKEN`
  и требует заголовок `x-admin-token`.
- Баланс, награды, submissions, рейтинг и статистика считаются исключительно на сервере;
  `userId`, `balance`, `reward`, `totalEarned`, суммы транзакций и позиция в рейтинге
  из запросов клиента не принимаются.

### Режим локальной разработки

Вне Telegram (`NODE_ENV !== "production"`) приложение работает на демо-пользователе:
**Игорь Рябов, @demo_user, 360 ₽** виртуального баланса. В `production` демо-режим
полностью отключён — запросы без валидного `initData` получают `401`.

## Деплой на Vercel (Neon PostgreSQL)

1. В Neon создайте базу и скопируйте **pooled** connection string
   (в нём уже есть `sslmode=require`).
2. В Vercel → **Settings → Environment Variables** задайте для Production и Preview:
   `DATABASE_URL` (строка Neon), `TELEGRAM_BOT_TOKEN`, `AUTH_SECRET`,
   при необходимости `ADMIN_TOKEN`. Только серверные переменные — без `NEXT_PUBLIC_`.
3. Build Command оставьте по умолчанию: в `package.json` есть скрипт
   **`vercel-build`** = `prisma generate && prisma migrate deploy && next build`
   (Vercel использует его автоматически). Сборка не требует файловой БД: клиент Prisma
   создаётся лениво, а миграции применяются к PostgreSQL.
4. После деплоя укажите URL приложения в BotFather (`/newapp`) и откройте Mini App.
5. При необходимости наполнить прод демо-данными — разово выполнить `npm run db:seed`
   с production-строкой в `DATABASE_URL` (локально, не в репозитории).

### Миграции

- Активная история: `prisma/migrations/` — **initial PostgreSQL migration `0_init`**
  (`prisma/migrations/0_init/migration.sql`), сгенерированная из текущей `schema.prisma`.
- Прежняя SQLite-история сохранена как архив в `prisma/migrations-sqlite/` и **не применяется**.
- Production migrations применяются командой:

```bash
npx prisma migrate deploy     # = npm run db:deploy
```

`prisma migrate reset` и любые destructive-команды на production-базе не используются.

### Работа с БД

`lib/prisma.ts` — единственное место, где создаётся Prisma Client (driver adapter `pg`,
строка подключения только из `DATABASE_URL`); `lib/db.ts` — server-only фасад для приложения.
Клиент создаётся лениво, поэтому `next build` проходит даже без `DATABASE_URL`.

## Подключение к Telegram

1. Создайте бота у [@BotFather](https://t.me/BotFather), положите токен в `TELEGRAM_BOT_TOKEN`.
2. `/newapp` → укажите URL приложения (или локальный туннель, например ngrok).
3. Откройте Mini App из бота — `TelegramProvider` получит `initData`, отправит его в
   `POST /api/auth/telegram`, сервер проверит HMAC-подпись и поставит сессию.

## API

| Метод | Endpoint | Назначение |
| --- | --- | --- |
| POST | `/api/auth/telegram` | валидация `initData` (HMAC-SHA256), выдача сессии |
| GET | `/api/tasks` | задания + прогресс «выполнено из N»; для `TELEGRAM_SUBSCRIPTION` — публичные данные каналов |
| GET | `/api/tasks/[id]` | задание, варианты ответов, submission пользователя, каналы |
| POST | `/api/submissions` | выполнение задания (атомарно: submission + транзакция + баланс); для `TELEGRAM_SUBSCRIPTION` сначала серверная проверка подписок |
| GET | `/api/profile` | профиль и статистика (место в рейтинге, выполнено сегодня) |
| GET | `/api/transactions` | история виртуальных операций (пагинация) |
| GET | `/api/leaderboard` | ТОП-30 по `totalEarned DESC` + отдельный блок текущего пользователя; перед выдачей выполняет daily update |
| GET | `/api/stats` | участники, минимальная награда, выплаченные бонусы (из `AppStats`) |
| GET/POST/PATCH/DELETE | `/api/admin/tasks`, `/api/admin/tasks/[id]` | заготовка админки (`x-admin-token`) |
| GET | `/api/admin/submissions`, `/api/admin/users` | заготовка админки |

## Задание «Подписка на Telegram-каналы»

Тип задания: `TaskType.TELEGRAM_SUBSCRIPTION` (первое задание на главном экране, +330 ₽).

**Где вставлять реальные каналы:** `config/telegram-channels.ts` — единственное место.
Для каждого канала заполните `url` (обычная или инвайт-ссылка) и `chatId`
(публичный `@username` или числовой id вида `-1001234567890`):

```ts
export const TELEGRAM_CHANNELS: TelegramChannelConfig[] = [
  { id: "channel_1", title: "Канал 1", username: "@channel_1", url: "https://t.me/channel_1", chatId: null },
  //                                                   ^ ссылка для пользователя            ^ null = «ещё не настроено»
];
```

Пока `chatId = null`, backend не обращается к Telegram API и возвращает понятное состояние
«Каналы ещё не настроены.» — задание не засчитывается. После подстановки значений проверка
заработает без изменений frontend.

**Как работает проверка (только backend):**

1. пользователь открывает каналы по кнопке «Подписаться» (открывается `url`);
2. нажимает «Проверить подписки» → `POST /api/submissions { taskId }`;
3. сервер берёт Telegram id из подписанной сессии (не из тела запроса) и вызывает
   Bot API `getChatMember` для каждого канала (`lib/telegram-channels.ts`);
4. подписан = `member` / `administrator` / `creator`, а также `restricted` с `is_member = true`;
   `left` / `kicked` — не подписан;
5. награда начисляется только если ВСЕ каналы подтверждены. Иначе:
   `409 CHANNELS_NOT_SUBSCRIBED` («Подпишитесь на все 3 канала») со статусами каналов в `details`;
6. ошибки Telegram API (`502 CHANNELS_CHECK_FAILED`) не засчитывают задание и показывают понятный текст;
   при проверке вне Telegram — `409 CHANNELS_CHECK_UNAVAILABLE`.

Frontend не может «заявить» о подписке: любые поля вида `subscribed: true` игнорируются.

**Права бота (важно):** добавьте бота в каждый канал **администратором**
(достаточно статуса администратора; отдельные права публикации не нужны).
Telegram гарантирует корректную работу `getChatMember` для других пользователей только
если бот — администратор канала. Если канал с заявками на вступление, учитывайте, что
до одобрения заявки пользователь ещё не считается участником.

## Ежедневная динамика рейтинга

`GET /api/leaderboard` перед выдачей списка выполняет обновление дня
(`lib/leaderboard-daily.ts`, таблица **`LeaderboardDailyUpdate`** с уникальной `date`):

- 10–25% demo-участников (`User.isMock = true`) получают личную случайную прибавку **+500…1000 ₽**;
- добавляется **2–4** новых demo-участника с начальным заработком 5 000…12 000 ₽
  (часть — в нижний диапазон, чтобы позиция реального пользователя продолжала немного двигаться);
- повторные запросы в тот же день ничего не меняют: уникальная дата + Prisma-транзакция
  защищают от параллельных запусков (проверено в том числе при одновременных запросах).

Ответ рейтинга: `entries` — всегда ТОП-30, `total` — всего участников,
`currentUser` — отдельный блок «Ваше место» / «Ваш заработок» (показывается, даже если
пользователь не попал в ТОП-30; тогда `isInTop: false`).

Реальные пользователи (в том числе текущий) ежедневных прибавок не получают — их заработок
растёт только от выполненных заданий, а позиция считается по реальному `totalEarned`.
`AppStats` (участники/бонусы на главном экране) — независимая механика, она не затронута.

## Безопасность

- `userId` никогда не принимается с фронтенда: он берётся из подписанной сессии.
- `reward` всегда читается из `Task` в БД, а не из тела запроса.
- Проверки перед выполнением: задание `ACTIVE`, дедлайн не прошёл, длина текста ≥ `minLength`,
  оценка при `requiresRating`, вариант ответа принадлежит заданию, пара `userId + taskId` уникальна.
- Начисление, транзакция и обновление баланса — внутри одной Prisma-транзакции.
- Ответы API не содержат stack trace; `alert()` нигде не используется.

## Структура

```
app/            страницы (/tasks, /tasks/[id], /top, /profile) и API-роуты
components/     layout, tasks, profile, leaderboard, transactions, telegram, theme, ui
lib/            telegram.ts, auth.ts, users.ts, db.ts, utils.ts, validation.ts, types.ts, hooks.ts, theme-script.ts
config/         branding.ts (название, описание, логотип, акцентный цвет #6C5CE7)
prisma/         schema.prisma, seed.ts, migrations
```

Все цвета и радиусы вынесены в CSS-переменные в `app/globals.css`
(`--primary`, `--background`, `--foreground`, `--muted`, `--border`, `--success`, `--error`),
поддержаны светлая и тёмная темы Telegram.

## Смена провайдера БД

Проект работает на PostgreSQL (`prisma/schema.prisma` → `provider = "postgresql"`).
Если понадобится другая СУБД, менять нужно только два места:

1. `prisma/schema.prisma` — `provider` в блоке `datasource` (в Prisma 7 URL в схеме не указывается);
2. `lib/prisma.ts` — driver adapter (сейчас `@prisma/adapter-pg`).

Дальше: `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
для новой initial-миграции и `npm run db:deploy`. UI, API и бизнес-логика не меняются:
всё общение с БД изолировано в `lib/prisma.ts` + server-only `lib/db.ts`.

## Ежедневная статистика (`AppStats`)

Публичная статистика главного экрана растёт раз в календарный день и хранится в БД
(таблица **`AppStats`**, модель в `prisma/schema.prisma`), а не в памяти процесса и не в
`localStorage` пользователя. Поэтому все видят одинаковые числа, и они не меняются при
обновлении страницы, повторных запросах, ререндере и открытии Mini App.

| Поле | Значение |
| --- | --- |
| `date` | локальная полночь дня, `@unique` — одна запись на календарный день |
| `participantsCount` | старт `2344`, дальше `+` случайное целое `20…50` за день |
| `totalBonuses` | старт `2 235 890`, дальше `+` случайное целое `15 000…25 000` за день |

Логика (`lib/app-stats.ts`, `getTodayStats()`):

1. если запись на сегодня есть — она и возвращается (значения не пересчитываются);
2. если нет — берётся последняя запись (предыдущий день);
3. первый запуск (`записей нет`) → ровно стартовые значения, без прироста;
4. иначе создаётся запись на сегодня с приростами `crypto.randomInt` (не `Math.random`);
5. при гонке параллельных первых запросов дня срабатывает `@unique` по `date` — используется
   уже созданная запись.

`GET /api/stats` возвращает `{ participantsCount, minimumReward, totalBonuses }`.
`formatBonusAmount()` в `lib/utils.ts` печатает сумму с точками-разделителями:
`2235890 → "+2.235.890 руб"`. Стартовая запись создаётся и в `prisma/seed.ts`,
но существующая НИКОГДА не перезаписывается.

## Тема оформления

Три режима, переключение — в **Профиле** (пункт «Тема») и быстрой иконкой в шапке профиля:

| Режим | Поведение |
| --- | --- |
| **Системная** (по умолчанию) | следует Telegram `colorScheme`, а вне Telegram — `prefers-color-scheme` |
| **Светлая** | всегда светлая, изменения темы Telegram игнорируются |
| **Тёмная** | всегда тёмная, изменения темы Telegram игнорируются |

- Выбор хранится в `localStorage` под ключом **`voxy-theme`** (`system` / `light` / `dark`).
- Приоритет при первом открытии: сохранённый режим → `Telegram.WebApp.colorScheme` →
  `prefers-color-scheme` → светлая.
- В режиме «Системная» приложение мгновенно реагирует на `themeChanged` в Telegram,
  изменение системной темы и возврат в Mini App (`activated` / `visibilitychange`).
- Тема применяется inline-скриптом в `<head>` (`lib/theme-script.ts`) **до первой отрисовки** —
  мигания светлого экрана нет (проверено на reload и при открытии Mini App).
- Все цвета живут в CSS-переменных (`app/globals.css`), в компонентах нет ни одного
  `dark:`-класса или хардкод-цвета. `--primary` всегда `#6C5CE7` в обеих темах.
- Переключение сопровождается коротким переходом 150ms (класс `theme-transition` на `<html>`),
  обычные тапы остаются мгновенными.

Тёмная тема — не инверсия: `--background: #111111`, `--card: #1C1C1E`,
`--card-secondary: #242428`, `--border: #343438`, `--muted: #A1A1AA`,
`--primary-soft: #282340`, невыбранные звёзды `#4A4A50`.

## Скролл

Приложение скроллится как обычная страница (документ). Важные детали, которые нельзя ломать:

- на `html`/`body` используется `overflow-x: clip` (**не** `hidden`) — `hidden` превращает
  `body` во вложенный scroll-контейнер и полностью блокирует вертикальную прокрутку;
- `body` имеет `min-height: 100dvh` и **никакой** фиксированной высоты — контент свободно
  растёт и прокручивается; `height: 100vh` / `overflow: hidden` на root-контейнерах не используются;
- bottom navigation — `position: fixed` снизу, контент страниц имеет
  `padding-bottom: calc(104px + env(safe-area-inset-bottom))`, поэтому навигация ничего не перекрывает;
- блокировка скролла для bottom sheet делается классом `scroll-locked` на `<html>` и всегда
  снимается в cleanup (не может «залипнуть»);
- `Telegram.WebApp.disableVerticalSwipes()` намеренно не вызывается: в части клиентов Telegram
  он перехватывает вертикальные свайпы и мешает прокрутке.

## Проверки

```bash
npm run typecheck   # 0 ошибок TypeScript
npm run lint        # 0 замечаний ESLint
npm run build       # production-сборка
```
