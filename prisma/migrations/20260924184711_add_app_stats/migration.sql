-- CreateTable
CREATE TABLE "AppStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "participantsCount" INTEGER NOT NULL,
    "totalBonuses" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AppStats_date_key" ON "AppStats"("date");

-- CreateIndex
CREATE INDEX "AppStats_date_idx" ON "AppStats"("date");
