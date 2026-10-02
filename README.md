# PayDoEarn — платформа заданий (Telegram Mini App)

> **Это игровой / тренировочный симулятор платформы заданий.**
> Все задания, отзывы, ответы, оценки и рубли — **виртуальные**.
> Пользователь не публикует реальные отзывы, не взаимодействует с Яндекс Картами,
> Google Maps и маркетплейсами, не получает реальных денег и не совершает
> никаких финансовых операций. Все `₽` — внутриигровая валюта приложения.

## Хранилище: PostgreSQL

Состояние пользователей, заявки, выполненные задания и операции лежат в PostgreSQL
(Neon или локальный сервер). Доступ — через пакет `pg` из одного server-only модуля
`lib/db.ts`, без ORM и без слоя репозиториев.

| Что | Где хранится |
| --- | --- |
| Пользователи (профиль, баланс, заработок, число заданий) | таблица `users`, `telegram_id` уникален |
| Заявки на вступление в каналы | таблица `channel_requests`, `UNIQUE(telegram_id, channel_id)` |
| Выполненные задания | таблица `task_completions`, `UNIQUE(telegram_id, task_id)` |
| История виртуальных операций | таблица `transactions` |
| Сессия Mini App | подписанная httpOnly-cookie (`voxy_state`) только с telegram id |
| Задания (тексты и награды) | `lib/demo-data.ts` — по-прежнему в коде |

Подключение создаётся лениво при первом запросе, поэтому `next build` не обращается
к базе (проверено: сборка проходит с недоступным `DATABASE_URL`).

### Схема

`scripts/init-db.sql` создаёт таблицы через `CREATE TABLE IF NOT EXISTS` (скрипт можно
запускать повторно). `scripts/init-db.mjs` применяет схему и наполняет демонстрационный
рейтинг (120 участников с флагом `is_demo = TRUE`), чтобы интерфейс не был пустым —
реальные пользователи Telegram попадают в те же таблицы без этого флага.

## Быстрый старт

```bash
npm install          # без postinstall и без prisma
cp .env.example .env # укажите DATABASE_URL, TELEGRAM_BOT_TOKEN, AUTH_SECRET, NEXT_PUBLIC_APP_URL
npm run db:init      # создаёт таблицы и демо-заполнение (идемпотентно)
npm run dev
```

### Переменные окружения (`.env`)

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | строка подключения PostgreSQL (Neon — pooled-строка). Читается только сервером (`lib/db.ts`) и не логируется |
| `TELEGRAM_BOT_TOKEN` | токен бота из @BotFather: проверка `initData`, ответ на `/start`. **Только сервер** |
| `AUTH_SECRET` | подпись httpOnly-сессии с telegram id (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | публичный HTTPS-адрес Mini App (тот же, что в BotFather) — URL кнопки «Открыть» |

Секретов с префиксом `NEXT_PUBLIC_` быть не должно: такие переменные попадают в клиентский бандл.
`DATABASE_URL` в клиентском коде не используется.


## Что внутри

Три раздела: **Задания** (`/tasks`), **Топ** (`/top`), **Профиль** (`/profile`).

Механика: открыть задание → выбрать готовый вариант ответа или написать свой текст →
поставить оценку 1–5 → «Выполнить задание» → сервер начисляет виртуальное
вознаграждение и обновляет подписанное состояние → обновляются баланс, история
операций, профиль и рейтинг.

## Стек

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 (дизайн-токены в `app/globals.css` через CSS variables)
- PostgreSQL через пакет `pg` (без ORM), Zod (валидация), lucide-react (иконки), Telegram WebApp API

## Что внутри

## Сессия Mini App

`lib/session.ts` (помечен `import "server-only"`) держит в подписанной httpOnly-cookie
**`voxy_state`** только telegram id:

- подпись HMAC-SHA256 от `AUTH_SECRET`, проверка через `crypto.timingSafeEqual`;
- `httpOnly`, `sameSite=none` + `secure` в production (Mini App может открываться в
  iframe Telegram Web/Desktop), `lax` локально, TTL 30 дней;
- баланс, заявки, выполненные задания и операции в cookie **не хранятся** — они в PostgreSQL.

Сервер (`requireUser()` в `lib/http.ts`) принимает две формы подтверждения, обе проверяются
одной функцией `validateTelegramInitData`:

1. заголовок `X-Telegram-Init-Data` — свежий initData текущего Mini App (клиент добавляет его
   в каждый запрос через `apiFetch`, `lib/api.ts`);
2. подписанная cookie `voxy_state` — если заголовка нет или он невалиден.

Заголовок важнее cookie: Telegram Web/Desktop открывает Mini App в iframe, и браузер может
не сохранить стороннюю cookie, а cookie из прошлой сессии может относиться к другому аккаунту.
Поэтому `/api/profile`, `/api/channel-requests`, `/api/transactions` и остальные защищённые
роуты авторизуются одинаково и работают даже без cookie. Без обоих источников — `401`.

### Порядок авторизации (нельзя нарушать)

1. `TelegramProvider` (`components/telegram/TelegramProvider.tsx`) ждёт `initData` от
   Telegram-клиента (`waitForInitData` в `lib/telegram.ts`): на холодном старте клиент отдаёт
   его с задержкой, поэтому SDK опрашивается до 8 c (вне Telegram — быстрый выход).
2. Только после появления `initData` уходит `POST /api/auth/telegram`.
3. Сервер проверяет HMAC-подпись, находит/создаёт пользователя в PostgreSQL
   (`INSERT … ON CONFLICT (telegram_id) DO UPDATE`) и ставит подписанную cookie.
4. Клиент получает 200 → `session.status = "ready"`, растёт `session.version`.
5. **Лишь теперь** экраны запрашивают данные: `useAuthedApi()` (`lib/hooks.ts`) отдаёт
   `null`-URL, пока идёт вход, поэтому запросы не уходят раньше, чем сервер поставил
   session cookie. Если вход завершился ошибкой, запрос всё равно выполняется один раз:
   `/api/tasks`, `/api/stats`, `/api/leaderboard` отдают данные без сессии, а
   `/api/channel-requests`, `/api/profile`, `/api/transactions` возвращают честный
   401/500 — экран показывает ответ сервера и кнопку повтора (ошибка не маскируется).
6. Все запросы идут через один механизм: `apiFetch` (`lib/api.ts`, `credentials: "include"`,
   `cache: "no-store"`) и `session.authedFetch`, который при 401 один раз повторяет вход
   (одновременные 401 делят одну попытку) и повторяет запрос. При смене `session.version`
   данные перезапрашиваются автоматически.

Если Mini App вернулся из фона без сессии (например, пользователь отправлял заявку в канале),
вход повторяется автоматически по `visibilitychange`, а на экранах есть кнопка «Повторить».

Быстрая диагностика production (без секретов): `GET /api/health` показывает
`database.configured/reachable/schema`, короткую причину сбоя (`SCHEMA_MISSING`,
`AUTH_FAILED`, `HOST_NOT_FOUND`, …) и наличие `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`,
`AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (только `true/false`).
`GET /api/health?auth=1` дополнительно показывает, **чем авторизован именно этот запрос**:
`initDataHeader` (`valid` / `present-but-invalid` / `absent`), `cookie` (`present`/`absent`),
получившийся `telegramId`, наличие пользователя в базе и его `requestedChannelIds`.
Эту ссылку можно открыть прямо в Telegram Mini App и сразу увидеть, доходят ли cookie и initData.

## Деплой на Vercel

1. Создайте базу в Neon и скопируйте pooled-строку подключения.
2. Схема **создаётся автоматически** при первом обращении к базе (`ensureSchema()` в
   `lib/db.ts` выполняет тот же идемпотентный DDL, что и `scripts/init-db.sql`) — пустая
   база больше не ломает `/api/stats`, `/api/leaderboard` и вход. Демо-заполнение
   (120 участников, флаг `is_demo`) по-прежнему добавляется вручную:
   `DATABASE_URL="<строка Neon>" npm run db:init`
3. Импортируйте репозиторий в Vercel. **Build Command менять не нужно** — стандартный
   `next build`; обращений к базе во время сборки нет (пул создаётся лениво, в runtime).
4. В **Settings → Environment Variables** задайте для Production и Preview:
   `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`.
   `NEXT_PUBLIC_APP_URL` подставляется **на этапе сборки**, поэтому после его изменения
   нужен новый деплой. Проверить значения на деплое: `GET /api/health`.
5. Deploy. После деплоя укажите URL приложения в BotFather (`/newapp`) и откройте Mini App.

Проверки локально:

```bash
npm run db:init                       # схема + демо-заполнение (идемпотентно)
npm run build                         # сборка не обращается к базе
npm run typecheck && npm run lint
```

## Подключение к Telegram

1. Создайте бота у [@BotFather](https://t.me/BotFather), положите токен в `TELEGRAM_BOT_TOKEN`.
2. `/newapp` → укажите URL приложения (или локальный туннель, например ngrok).
3. Откройте Mini App из бота — `TelegramProvider` получит `initData`, отправит его в
   `POST /api/auth/telegram`, сервер проверит HMAC-подпись, создаст или обновит
   пользователя в PostgreSQL и поставит подписанную сессию.

Секрет `TELEGRAM_BOT_TOKEN` живёт только в `process.env` (`lib/env.ts`) и никогда
не попадает ни в JSON, ни в код, ни в git, ни в клиентский бандл.

### Режим локальной разработки

Вне Telegram (`NODE_ENV !== "production"`) приложение входит демо-пользователем из базы
(**Игорь Рябов, @demo_user**, `telegram_id = 999000001`, флаг `is_demo = TRUE`, стартовый
баланс 360 ₽ из `db:init`). В `production` демо-режим полностью отключён — запросы без
валидного `initData` получают `401`.

## Telegram-бот: `/start` и кнопка «Открыть»

Минимальная логика бота без polling, без SDK (никаких Telegraf/grammY) и без БД:
Telegram вызывает наш webhook на Vercel, роут отвечает одним `sendMessage` через
обычный server-side `fetch`.

```
Telegram → POST /api/telegram/webhook → sendMessage → кнопка «Открыть» → Mini App
```

| Файл | Роль |
| --- | --- |
| `app/api/telegram/webhook/route.ts` | принимает Telegram Update, распознаёт `/start`, отвечает приветствием |
| `lib/telegram-bot.ts` | server-only обёртка над Bot API: `sendTelegramMessage()`, текст приветствия, клавиатура |

Поведение:

- `/start`, `/start <payload>`, `/start@botname`, `/start@botname <payload>` — во всех
  случаях бот отправляет **одно** сообщение методом `sendPhoto`: баннер
  `<NEXT_PUBLIC_APP_URL>/telegram-start-banner.png` + текст приветствия в `caption`
  + inline-кнопка «Открыть» с URL Mini App из `NEXT_PUBLIC_APP_URL`
  (картинка не отправляется отдельным сообщением);
- `NEXT_PUBLIC_APP_URL` должен быть абсолютным HTTPS-адресом, иначе `/start` отвечает
  `500 APP_URL_INVALID` (localhost/http не пройдут);
- файл баннера: **`public/telegram-start-banner.png`** (добавьте картинку в репозиторий —
  Telegram скачивает её по публичному URL);
- ответ уходит ровно в `message.chat.id` (telegram user id для этого не используется);
- любые другие сообщения/update игнорируются с ответом `200 { "ok": true, "ignored": true }` —
  endpoint не падает на незнакомых типах update и на битом JSON;
- `GET /api/telegram/webhook` → `405` (`Allow: POST`);
- повторный `/start` всегда отправляет то же сообщение (никаких состояний и записей в БД);
- полный Telegram Update в production не логируется, токен не логируется никогда
  (даже текст ошибки от Telegram очищается от токена);
- если `TELEGRAM_BOT_TOKEN` не задан — `503 BOT_NOT_CONFIGURED`, если не задан
  `NEXT_PUBLIC_APP_URL` — `503 APP_URL_NOT_CONFIGURED` (никаких localhost/fake-фолбэков
  в коде нет);
- если Telegram API вернул ошибку, роут логирует безопасную информацию
  (`chat_id`, код, текст ошибки) и отвечает `200 { "ok": true, "delivered": false }`,
  чтобы Telegram не повторял один и тот же update бесконечно.

### Установка webhook

Webhook нужно поставить один раз после деплоя. Вместо `<TOKEN>` подставьте токен своего
бота, вместо `YOUR_VERCEL_DOMAIN` — домен проекта (без `localhost`):

```bash
# 1. Установить webhook: Telegram будет стучаться в наш роут на Vercel
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_VERCEL_DOMAIN/api/telegram/webhook"

# 2. Проверить, что webhook установлен и ошибок нет
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Чтобы не светить токен в истории команд, можно задать его переменной окружения и
подставлять `$TOKEN`:

```bash
TOKEN="<TOKEN из @BotFather>"
curl "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://YOUR_VERCEL_DOMAIN/api/telegram/webhook"
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

Альтернативный вариант — браузерная строка (URL тот же, что и в `curl`).

> URL кнопки «Открыть» берётся из `NEXT_PUBLIC_APP_URL` и должен совпадать с тем адресом,
> который уже указан для Mini App в BotFather (`/newapp`). Новый Mini App создавать не нужно.
>
> `NEXT_PUBLIC_*` подставляется в сборку на этапе `next build`, поэтому после изменения
> `NEXT_PUBLIC_APP_URL` в Vercel нужен **новый деплой** (redeploy), а не только перезапуск.

Локальная проверка роута без реального Telegram: задайте переменную `TELEGRAM_API_BASE`
(например, `http://127.0.0.1:3199`), поднимите мок Bot API и отправьте `POST` с любым
Telegram Update на `/api/telegram/webhook` — так проверяется точный payload `sendMessage`
(текст и `web_app`-кнопка). Переменная описана в `lib/telegram-bot.ts` и **не задаётся**
в production.

## API

| Метод | Endpoint | Назначение |
| --- | --- | --- |
| POST | `/api/auth/telegram` | валидация `initData` (HMAC-SHA256), создание/обновление пользователя в PostgreSQL, подписанная сессия |
| GET | `/api/tasks` | задания + прогресс; для `TELEGRAM_SUBSCRIPTION` — каналы и статусы заявок, остальные задания `locked` до 3/3 |
| GET | `/api/tasks/[id]` | задание, варианты ответов, результат пользователя, каналы |
| POST | `/api/submissions` | выполнение задания одной транзакцией PostgreSQL (`task_completions` + `transactions` + баланс) |
| GET | `/api/channel-requests` | статус заявок из `channel_requests` (кнопка «Проверить заявки») |
| GET | `/api/profile` | профиль и статистика из базы (место в рейтинге, выполнено сегодня) |
| GET | `/api/transactions` | история виртуальных операций пользователя (пагинация) |
| GET | `/api/leaderboard` | ТОП-30 по `total_earned DESC` + блок текущего пользователя |
| GET | `/api/stats` | участники и выплаченные бонусы по таблице `users` |
| GET | `/api/health` | диагностика окружения: доступность базы, наличие схемы, короткая причина сбоя, наличие серверных переменных (без секретов) |
| POST | `/api/telegram/webhook` | Telegram Update: `chat_join_request` → запись в `channel_requests`; `/start` → приветствие с кнопкой «Открыть» |

Админ-API (`/api/admin/*`) в MVP удалён вместе с БД: задания задаются в коде,
администрировать в статическом демо нечего.

## Задание «Подписка на Telegram-каналы»

Тип задания: `TELEGRAM_SUBSCRIPTION` — обязательное первое задание (+330 ₽).
Пока Telegram не пришлёт заявки по всем трём каналам, остальные задания закрыты.

**Где менять каналы:** `config/telegram-channels.ts` — единственное место.
У каждого канала есть `index` (1…3), `title`, `description`, постоянная invite-ссылка
`url` и необязательный `chatId` (второй признак для сопоставления заявки).

Как это работает:

- кнопка «Подписаться» открывает invite-ссылку через `Telegram.WebApp.openTelegramLink()`
  и **сама по себе ничего не засчитывает**;
- бот-администратор получает `chat_join_request` → webhook определяет канал по
  `invite_link.invite_link` и пишет строку в `channel_requests`
  (`INSERT ... ON CONFLICT (telegram_id, channel_id) DO NOTHING`);
- в задании есть кнопка **«Проверить заявки»**: она запрашивает `GET /api/channel-requests`,
  который читает `channel_requests` из PostgreSQL и возвращает счётчик `N/3` и статусы
  «Ожидаем заявку» / «Запрос отправлен»;
- при `3/3` задание можно завершить (начисление +330 ₽), остальные задания открываются;
- `getChatMember` не используется, отдельные invite-ссылки для пользователей не создаются.

## Рейтинг и статистика

Оба экрана считаются по таблице `users`:

- `GET /api/leaderboard` — `ORDER BY total_earned DESC` (ТОП-30), текущий пользователь
  определяется по `telegram_id` из сессии и показывается отдельным блоком «Ваше место»;
- `GET /api/stats` — `participantsCount` = число строк в `users`,
  `totalBonuses` = `SUM(total_earned)`, `minimumReward` — минимальная награда среди заданий.

Демонстрационное заполнение рейтинга (120 участников) лежит в той же таблице с флагом
`is_demo = TRUE` и не подмешивается ниоткуда больше: реальные пользователи Telegram
хранятся рядом без этого флага.

`formatBonusAmount()` в `lib/utils.ts` печатает сумму с точками-разделителями:
`2323432 → "+2.323.432 руб"`.

## Безопасность

- Telegram id никогда не принимается с фронтенда: он берётся из подписанной сессии
  (подпись проверяется через `timingSafeEqual`), а данные — из PostgreSQL по этому id.
- `reward` всегда берётся из определения задания (`lib/demo-data.ts`), а не из тела запроса.
- Начисление идёт одной транзакцией PostgreSQL: `INSERT task_completions ... ON CONFLICT DO NOTHING`
  + `transactions` + обновление `balance/total_earned/completed_tasks`; повторить задание нельзя.
- Заявки на каналы учитываются только из `chat_join_request` от Telegram (факт нажатия
  кнопки или открытия ссылки не засчитывается); `getChatMember` не используется.
- Запросы идут только параметризованными (`$1`, `$2`), `DATABASE_URL` живёт в
  `process.env` внутри `server-only` модуля и не попадает ни в логи, ни в клиентский бандл.
- Ответы API не содержат stack trace; `alert()` нигде не используется.
- Реальных денежных операций нет: все суммы виртуальные.

## Структура

```
app/            страницы (/tasks, /tasks/[id], /top, /profile) и API-роуты
components/     layout, tasks, profile, leaderboard, transactions, telegram, theme, ui
lib/            db.ts (пул pg + все SQL-запросы), session.ts (подписанная cookie),
                auth.ts (initData, вход, текущий пользователь), tasks.ts (состояния заданий),
                demo-data.ts (тексты заданий), telegram.ts (WebApp API), env.ts, http.ts,
                utils.ts, validation.ts, types.ts, hooks.ts, theme-script.ts
config/         branding.ts (название, описание, иконка, акцентный цвет #0062FD),
                telegram-channels.ts (каналы задания-подписки)
scripts/        init-db.sql + init-db.mjs (схема и демо-заполнение, npm run db:init)
```

Все цвета и радиусы вынесены в CSS-переменные в `app/globals.css`
(`--primary`, `--background`, `--foreground`, `--muted`, `--border`, `--success`, `--error`),
поддержаны светлая и тёмная темы Telegram.

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
  мигания светлого экрана нет.
- Все цвета живут в CSS-переменных (`app/globals.css`), в компонентах нет ни одного
  `dark:`-класса или хардкод-цвета. Акцент — основной синий логотипа PayDoEarn
  **`#0062FD`** (RGB 0/98/253), `--primary` одинаков в обеих темах.
- Переключение сопровождается коротким переходом 150ms (класс `theme-transition` на `<html>`),
  обычные тапы остаются мгновенными.

Тёмная тема — не инверсия: `--background: #111111`, `--card: #1C1C1E`,
`--card-secondary: #242428`, `--border: #343438`, `--muted: #A1A1AA`,
`--primary-soft: #0F1B2D` (синий акцент в тёмной поверхности), невыбранные звёзды `#4A4A50`.

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
npm run build       # production-сборка (без DATABASE_URL)
npm run start       # прод-сервер: страницы и API работают без внешней БД
curl localhost:3000/api/health   # диагностика окружения и базы
```



