/*
  Warnings:

  - Added the required column `medicineName` to the `StockTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "healthUnitId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "medicineDetails" TEXT,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockTransaction_healthUnitId_fkey" FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockTransaction" ("createdAt", "healthUnitId", "id", "medicineId", "quantity", "type", "userId") SELECT "createdAt", "healthUnitId", "id", "medicineId", "quantity", "type", "userId" FROM "StockTransaction";
DROP TABLE "StockTransaction";
ALTER TABLE "new_StockTransaction" RENAME TO "StockTransaction";
CREATE INDEX "StockTransaction_healthUnitId_medicineId_idx" ON "StockTransaction"("healthUnitId", "medicineId");
CREATE INDEX "StockTransaction_createdAt_idx" ON "StockTransaction"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
