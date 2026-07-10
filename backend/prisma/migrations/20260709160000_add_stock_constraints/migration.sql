-- AlterTable: adiciona controle de auditoria de atualização ao saldo de estoque
ALTER TABLE "MedicineStock" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: garante que não existam dois registros de saldo para o mesmo par unidade+medicamento
CREATE UNIQUE INDEX "MedicineStock_healthUnitId_medicineId_key" ON "MedicineStock"("healthUnitId", "medicineId");

-- CreateIndex: otimiza consultas de histórico de movimentação por unidade/medicamento
CREATE INDEX "StockTransaction_healthUnitId_medicineId_idx" ON "StockTransaction"("healthUnitId", "medicineId");

-- CreateIndex: otimiza consultas de auditoria ordenadas por data
CREATE INDEX "StockTransaction_createdAt_idx" ON "StockTransaction"("createdAt");
