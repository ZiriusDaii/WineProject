-- CreateEnum
CREATE TYPE "ServiceGender" AS ENUM ('MUJER', 'HOMBRE', 'UNISEX');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "gender" "ServiceGender" NOT NULL DEFAULT 'UNISEX';
