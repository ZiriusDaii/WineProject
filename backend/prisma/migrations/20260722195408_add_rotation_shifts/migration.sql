-- AlterTable
ALTER TABLE "users" ADD COLUMN     "anchor_week" INTEGER DEFAULT 1,
ADD COLUMN     "anchor_year" INTEGER DEFAULT 2026,
ADD COLUMN     "default_shift_id" TEXT,
ADD COLUMN     "rotation_shift_1_id" TEXT,
ADD COLUMN     "rotation_shift_2_id" TEXT,
ADD COLUMN     "rotation_type" TEXT DEFAULT 'WEEKLY_ROTATION';

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_shift_id_fkey" FOREIGN KEY ("default_shift_id") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_rotation_shift_1_id_fkey" FOREIGN KEY ("rotation_shift_1_id") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_rotation_shift_2_id_fkey" FOREIGN KEY ("rotation_shift_2_id") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
