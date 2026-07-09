-- AlterTable
ALTER TABLE "Exam" ADD COLUMN "lab_externo" TEXT;

-- CreateTable
CREATE TABLE "HealthUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MedicineStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "healthUnitId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MedicineStock_healthUnitId_fkey" FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "healthUnitId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockTransaction_healthUnitId_fkey" FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "crm" TEXT,
    "specialty" TEXT,
    "unit" TEXT,
    "healthUnitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_healthUnitId_fkey" FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "createdAt", "crm", "email", "id", "name", "passwordHash", "role", "specialty", "unit") SELECT "active", "createdAt", "crm", "email", "id", "name", "passwordHash", "role", "specialty", "unit" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
