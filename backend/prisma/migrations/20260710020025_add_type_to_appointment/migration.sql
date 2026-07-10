-- CreateTable
CREATE TABLE "AppointmentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialty" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "specificDate" TEXT,
    "maxOnlineSlots" INTEGER NOT NULL DEFAULT 10,
    "maxTotalSlots" INTEGER NOT NULL DEFAULT 20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "unit" TEXT NOT NULL DEFAULT 'UBS Central',
    "status" TEXT NOT NULL DEFAULT 'aguardando',
    "justification" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'presencial',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("checkedIn", "createdAt", "doctorId", "id", "justification", "patientId", "priority", "scheduledAt", "specialty", "status", "unit") SELECT "checkedIn", "createdAt", "doctorId", "id", "justification", "patientId", "priority", "scheduledAt", "specialty", "status", "unit" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
