/*
  Warnings:

  - The `availability` column on the `Pin` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `Board` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('in_stock', 'out_of_stock', 'preorder');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Pin" ALTER COLUMN "scheduledAt" DROP NOT NULL,
DROP COLUMN "availability",
ADD COLUMN     "availability" "ProductAvailability";

-- AlterTable
ALTER TABLE "PinterestAccount" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Board_deletedAt_idx" ON "Board"("deletedAt");

-- CreateIndex
CREATE INDEX "Pin_pinterestAccountId_idx" ON "Pin"("pinterestAccountId");

-- CreateIndex
CREATE INDEX "Pin_deletedAt_idx" ON "Pin"("deletedAt");

-- CreateIndex
CREATE INDEX "PinterestAccount_deletedAt_idx" ON "PinterestAccount"("deletedAt");
