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
    "appointmentType" TEXT NOT NULL DEFAULT 'presencial',
    "doctorName" TEXT,
    "doctorCrm" TEXT,
    "doctorScheduleLockId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorScheduleLockId_fkey" FOREIGN KEY ("doctorScheduleLockId") REFERENCES "DoctorScheduleLock" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("createdAt", "doctorCrm", "doctorId", "doctorName", "doctorScheduleLockId", "id", "patientId", "priority", "scheduledAt", "specialty", "status", "unit") SELECT "createdAt", "doctorCrm", "doctorId", "doctorName", "doctorScheduleLockId", "id", "patientId", "priority", "scheduledAt", "specialty", "status", "unit" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
