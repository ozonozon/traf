-- CreateTable
CREATE TABLE "LeaderboardDailyUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "updatedUsers" INTEGER NOT NULL DEFAULT 0,
    "createdUsers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "photoUrl" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("balance", "completedTasks", "createdAt", "firstName", "id", "isDemo", "lastName", "photoUrl", "telegramId", "totalEarned", "updatedAt", "username") SELECT "balance", "completedTasks", "createdAt", "firstName", "id", "isDemo", "lastName", "photoUrl", "telegramId", "totalEarned", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
CREATE INDEX "User_totalEarned_idx" ON "User"("totalEarned");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardDailyUpdate_date_key" ON "LeaderboardDailyUpdate"("date");

-- CreateIndex
CREATE INDEX "LeaderboardDailyUpdate_date_idx" ON "LeaderboardDailyUpdate"("date");
