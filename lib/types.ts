/**
 * Общие DTO, используемые и на сервере, и на клиенте.
 * Все денежные значения — виртуальные игровые рубли.
 */

/**
 * Публичное представление пользователя: только то, что нужно интерфейсу.
 * Внутренние поля (id, telegramId, isMock) на клиент не уходят.
 */
export interface PublicUserDto {
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  balance: number;
  totalEarned: number;
  completedTasks: number;
  isDemo: boolean;
}

export type TaskState = "available" | "completed" | "expired" | "paused" | "locked";

/** Публичные данные Telegram-канала для задания «Подписка на Telegram-каналы». */
export interface TaskChannelDto {
  /** Номер канала 1..3 (совпадает с channel1Requested…channel3Requested в состоянии). */
  index: 1 | 2 | 3;
  id: string;
  title: string;
  description: string;
  url: string;
  /** true — Telegram прислал chat_join_request по этому каналу. Только серверное значение. */
  requested: boolean;
}

export interface TaskListItemDto {
  id: string;
  title: string;
  description: string;
  icon: string;
  reward: number;
  type: string;
  virtualTarget: string;
  minLength: number;
  deadline: string;
  requiresRating: boolean;
  state: TaskState;
  /** Только для задач типа TELEGRAM_SUBSCRIPTION. */
  channels?: TaskChannelDto[];
}

export interface TaskOptionDto {
  id: string;
  text: string;
}

export interface SubmissionDto {
  answer: string;
  rating: number | null;
  selectedOptionId: string | null;
  reward: number;
  createdAt: string;
}

export interface TaskDetailDto extends TaskListItemDto {
  conditions: string;
  options: TaskOptionDto[];
  submission: SubmissionDto | null;
}

export interface TasksProgressDto {
  completed: number;
  total: number;
  remaining: number;
}

export interface TasksResponseDto {
  tasks: TaskListItemDto[];
  progress: TasksProgressDto;
}

export interface TaskDetailResponseDto {
  task: TaskDetailDto;
}

export interface SubmissionResponseDto {
  submission: SubmissionDto;
  user: PublicUserDto;
  reward: number;
}

export interface ProfileStatsDto {
  completedTasks: number;
  completedToday: number;
  balance: number;
  totalEarned: number;
  rank: number;
  totalUsers: number;
}

export interface ProfileResponseDto {
  user: PublicUserDto;
  stats: ProfileStatsDto;
}

export interface TransactionDto {
  id: string;
  amount: number;
  type: "EARN" | "SPEND";
  description: string;
  createdAt: string;
}

export interface TransactionsResponseDto {
  transactions: TransactionDto[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface LeaderboardEntryDto {
  rank: number;
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  totalEarned: number;
  completedTasks: number;
  isCurrentUser: boolean;
}

/** Текущий пользователь: показывается отдельным блоком под ТОП-30. */
export interface LeaderboardCurrentUserDto {
  rank: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  totalEarned: number;
  completedTasks: number;
  /** true — пользователь попал в ТОП-30 (тогда дублировать строку списка не нужно). */
  isInTop: boolean;
}

export interface LeaderboardResponseDto {
  /** Всегда ТОП-30 (или меньше, если участников ещё мало). */
  entries: LeaderboardEntryDto[];
  /** Сколько всего участников в рейтинге. */
  total: number;
  topLimit: number;
  currentUser: LeaderboardCurrentUserDto | null;
}

export interface StatsResponseDto {
  participantsCount: number;
  minimumReward: number;
  totalBonuses: number;
}

export interface AuthResponseDto {
  user: PublicUserDto;
  mode: "telegram" | "demo";
}
