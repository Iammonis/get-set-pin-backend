/*
  Warnings:

  - The `status` column on the `Pin` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[pinterestId]` on the table `PinterestAccount` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdBy` to the `Pin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Pin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `Pin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PinterestAccount` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `plan` on the `Subscription` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PinStatus" AS ENUM ('scheduled', 'posted', 'failed');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('free', 'starter', 'pro', 'business');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "RichPinType" AS ENUM ('recipe', 'article', 'product');

-- AlterTable
ALTER TABLE "Pin" ADD COLUMN     "availability" BOOLEAN,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "link" TEXT,
ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'image',
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "richPinType" "RichPinType",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT NOT NULL,
ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "imageUrl" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "PinStatus" NOT NULL DEFAULT 'scheduled';

-- AlterTable
ALTER TABLE "PinterestAccount" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "plan",
ADD COLUMN     "plan" "PlanType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinterestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_pinterestId_key" ON "Board"("pinterestId");

-- CreateIndex
CREATE INDEX "Board_pinterestId_idx" ON "Board"("pinterestId");

-- CreateIndex
CREATE INDEX "Pin_boardId_idx" ON "Pin"("boardId");

-- CreateIndex
CREATE UNIQUE INDEX "PinterestAccount_pinterestId_key" ON "PinterestAccount"("pinterestId");

-- CreateIndex
CREATE INDEX "PinterestAccount_pinterestId_idx" ON "PinterestAccount"("pinterestId");

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
