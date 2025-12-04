-- CreateEnum
CREATE TYPE "TimezonePreference" AS ENUM ('WORKSPACE', 'LOCAL');

-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('DMY', 'MDY', 'YMD');

-- CreateEnum
CREATE TYPE "TimeFormat" AS ENUM ('H24', 'H12');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dateFormat" "DateFormat" NOT NULL DEFAULT 'DMY',
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "timeFormat" "TimeFormat" NOT NULL DEFAULT 'H24',
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "timezonePreference" "TimezonePreference" NOT NULL DEFAULT 'WORKSPACE';
