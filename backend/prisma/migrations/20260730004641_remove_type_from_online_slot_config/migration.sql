/*
  Warnings:

  - You are about to drop the column `type` on the `OnlineSlotConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OnlineSlotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unit" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "onlinePercentage" INTEGER NOT NULL DEFAULT 0,
    "maxOnlineSlots" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OnlineSlotConfig" ("createdAt", "dayOfWeek", "id", "maxOnlineSlots", "onlinePercentage", "unit", "updatedAt") SELECT "createdAt", "dayOfWeek", "id", "maxOnlineSlots", "onlinePercentage", "unit", "updatedAt" FROM "OnlineSlotConfig";
DROP TABLE "OnlineSlotConfig";
ALTER TABLE "new_OnlineSlotConfig" RENAME TO "OnlineSlotConfig";
CREATE UNIQUE INDEX "OnlineSlotConfig_unit_dayOfWeek_key" ON "OnlineSlotConfig"("unit", "dayOfWeek");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
