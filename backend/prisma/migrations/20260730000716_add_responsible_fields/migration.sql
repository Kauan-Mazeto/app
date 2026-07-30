/*
  Warnings:

  - You are about to drop the column `checkedIn` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `justification` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `lockId` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Appointment` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'agendado',
    "scheduledAt" DATETIME NOT NULL,
    "unit" TEXT,
    "doctorName" TEXT,
    "doctorCrm" TEXT,
    "doctorScheduleLockId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorScheduleLockId_fkey" FOREIGN KEY ("doctorScheduleLockId") REFERENCES "DoctorScheduleLock" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("createdAt", "doctorId", "id", "patientId", "priority", "scheduledAt", "specialty", "status", "unit") SELECT "createdAt", "doctorId", "id", "patientId", "priority", "scheduledAt", "specialty", "status", "unit" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "lgpdAccepted" BOOLEAN NOT NULL DEFAULT false,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "blockedOnline" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sex" TEXT,
    "motherName" TEXT,
    "fatherName" TEXT,
    "susCard" TEXT,
    "cep" TEXT,
    "cityState" TEXT,
    "nearestUnit" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "substanceUse" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "responsibleAllowed" BOOLEAN NOT NULL DEFAULT false,
    "responsibleName" TEXT,
    "responsibleCpf" TEXT,
    "responsiblePhone" TEXT,
    "responsibleRelationshipLevel" TEXT
);
INSERT INTO "new_Patient" ("active", "address", "allergies", "birthDate", "blockedOnline", "cep", "chronicConditions", "cityState", "cpf", "createdAt", "emergencyContactName", "emergencyContactPhone", "fatherName", "id", "lgpdAccepted", "missedCount", "motherName", "name", "nearestUnit", "phone", "sex", "substanceUse", "susCard") SELECT "active", "address", "allergies", "birthDate", "blockedOnline", "cep", "chronicConditions", "cityState", "cpf", "createdAt", "emergencyContactName", "emergencyContactPhone", "fatherName", "id", "lgpdAccepted", "missedCount", "motherName", "name", "nearestUnit", "phone", "sex", "substanceUse", "susCard" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_cpf_key" ON "Patient"("cpf");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
