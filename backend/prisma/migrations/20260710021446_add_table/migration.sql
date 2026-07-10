-- CreateTable
CREATE TABLE "OnlineSlotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unit" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "onlinePercentage" INTEGER NOT NULL DEFAULT 50,
    "maxOnlineSlots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OnlineSlotConfig_unit_dayOfWeek_key" ON "OnlineSlotConfig"("unit", "dayOfWeek");
