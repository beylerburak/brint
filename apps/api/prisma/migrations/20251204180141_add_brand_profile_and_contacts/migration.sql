-- CreateEnum
CREATE TYPE "BrandContactType" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'ADDRESS', 'WEBSITE');

-- CreateTable
CREATE TABLE "brand_contact_channels" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" "BrandContactType" NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_contact_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "data" JSONB NOT NULL,
    "optimizationScore" INTEGER,
    "optimizationScoreUpdatedAt" TIMESTAMP(3),
    "aiSummaryShort" TEXT,
    "aiSummaryDetailed" TEXT,
    "lastEditedByUserId" TEXT,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAiRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_contact_channels_brandId_type_idx" ON "brand_contact_channels"("brandId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profiles_brandId_key" ON "brand_profiles"("brandId");

-- AddForeignKey
ALTER TABLE "brand_contact_channels" ADD CONSTRAINT "brand_contact_channels_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

