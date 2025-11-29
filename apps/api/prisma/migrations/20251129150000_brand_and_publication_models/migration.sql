-- Brand model updates: Add wizard/readiness fields and brand-level settings

-- Add new columns to brands table
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "toneOfVoice" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "hasAtLeastOneSocialAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "publishingDefaultsConfigured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "readinessScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "logoMediaId" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- Update index for brands (drop old index if exists and create new)
DROP INDEX IF EXISTS "brands_workspaceId_updatedAt_idx";
CREATE INDEX IF NOT EXISTS "brands_workspaceId_createdAt_idx" ON "brands"("workspaceId", "createdAt");

-- CreateTable: BrandHashtagPreset
CREATE TABLE IF NOT EXISTS "brand_hashtag_presets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_hashtag_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BrandHashtagPreset
CREATE INDEX IF NOT EXISTS "brand_hashtag_presets_workspaceId_brandId_idx" ON "brand_hashtag_presets"("workspaceId", "brandId");

-- AddForeignKey: BrandHashtagPreset -> Workspace
ALTER TABLE "brand_hashtag_presets" ADD CONSTRAINT "brand_hashtag_presets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BrandHashtagPreset -> Brand
ALTER TABLE "brand_hashtag_presets" ADD CONSTRAINT "brand_hashtag_presets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum: PublicationPlatform
DO $$ BEGIN
    CREATE TYPE "PublicationPlatform" AS ENUM ('instagram', 'facebook', 'linkedin', 'tiktok', 'twitter');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: PublicationContentType
DO $$ BEGIN
    CREATE TYPE "PublicationContentType" AS ENUM ('feed_post', 'reel', 'story', 'carousel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: PublicationStatus
DO $$ BEGIN
    CREATE TYPE "PublicationStatus" AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: Content
CREATE TABLE IF NOT EXISTS "contents" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "baseCaption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Content
CREATE INDEX IF NOT EXISTS "contents_workspaceId_brandId_idx" ON "contents"("workspaceId", "brandId");

-- AddForeignKey: Content -> Workspace
ALTER TABLE "contents" ADD CONSTRAINT "contents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Content -> Brand
ALTER TABLE "contents" ADD CONSTRAINT "contents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Publication
CREATE TABLE IF NOT EXISTS "publications" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "platform" "PublicationPlatform" NOT NULL,
    "contentType" "PublicationContentType" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" "PublicationStatus" NOT NULL,
    "settings" JSONB NOT NULL,
    "error" JSONB,
    "externalPostId" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Publication
CREATE INDEX IF NOT EXISTS "publications_workspaceId_brandId_idx" ON "publications"("workspaceId", "brandId");
CREATE INDEX IF NOT EXISTS "publications_contentId_idx" ON "publications"("contentId");
CREATE INDEX IF NOT EXISTS "publications_status_scheduledAt_idx" ON "publications"("status", "scheduledAt"); -- Worker query optimization

-- AddForeignKey: Publication -> Workspace
ALTER TABLE "publications" ADD CONSTRAINT "publications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Publication -> Brand
ALTER TABLE "publications" ADD CONSTRAINT "publications_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Publication -> Content
ALTER TABLE "publications" ADD CONSTRAINT "publications_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

