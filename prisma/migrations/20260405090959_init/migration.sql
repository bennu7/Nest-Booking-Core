/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
