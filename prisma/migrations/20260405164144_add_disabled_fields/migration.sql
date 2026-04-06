-- AlterTable
ALTER TABLE "tenants" 
ADD COLUMN     "disabled_at" TIMESTAMP(3),
ADD COLUMN     "disabled_by" TEXT,
ADD COLUMN     "disabled_reason" VARCHAR(500);

-- AlterTable
ALTER TABLE "users" 
ADD COLUMN     "disabled_at" TIMESTAMP(3),
ADD COLUMN     "disabled_by" TEXT,
ADD COLUMN     "disabled_reason" VARCHAR(500);

-- AddForeignKey
ALTER TABLE "users" 
ADD CONSTRAINT "users_disabled_by_fkey" 
FOREIGN KEY ("disabled_by") 
REFERENCES "users"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;
