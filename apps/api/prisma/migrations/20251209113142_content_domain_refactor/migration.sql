-- CreateEnum
CREATE TYPE "ContentFormFactor" AS ENUM ('FEED_POST', 'STORY', 'VERTICAL_VIDEO', 'BLOG_ARTICLE', 'LONG_VIDEO');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'QUEUED', 'PUBLISHING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "VerticalVideoCoverMode" AS ENUM ('AUTO', 'FROM_FRAME', 'CUSTOM_UPLOAD');

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "formFactor" "ContentFormFactor" NOT NULL,
    "baseCaption" TEXT,
    "platformCaptions" JSONB,
    "tags" TEXT[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_accounts" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_media" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "platformPostId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "payloadSnapshot" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_account_options" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "captionOverride" TEXT,
    "coverMode" "VerticalVideoCoverMode",
    "coverFrameTimeSec" DOUBLE PRECISION,
    "coverMediaId" TEXT,
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "thumbnailMode" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_account_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contents_brandId_idx" ON "contents"("brandId");

-- CreateIndex
CREATE INDEX "contents_workspaceId_idx" ON "contents"("workspaceId");

-- CreateIndex
CREATE INDEX "contents_status_idx" ON "contents"("status");

-- CreateIndex
CREATE INDEX "contents_scheduledAt_idx" ON "contents"("scheduledAt");

-- CreateIndex
CREATE INDEX "contents_deletedAt_idx" ON "contents"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_accounts_contentId_socialAccountId_key" ON "content_accounts"("contentId", "socialAccountId");

-- CreateIndex
CREATE INDEX "content_accounts_contentId_idx" ON "content_accounts"("contentId");

-- CreateIndex
CREATE INDEX "content_accounts_socialAccountId_idx" ON "content_accounts"("socialAccountId");

-- CreateIndex
CREATE INDEX "content_accounts_deletedAt_idx" ON "content_accounts"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_media_contentId_mediaId_key" ON "content_media"("contentId", "mediaId");

-- CreateIndex
CREATE INDEX "content_media_contentId_idx" ON "content_media"("contentId");

-- CreateIndex
CREATE INDEX "content_media_mediaId_idx" ON "content_media"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "publications_contentId_socialAccountId_key" ON "publications"("contentId", "socialAccountId");

-- CreateIndex
CREATE INDEX "publications_contentId_idx" ON "publications"("contentId");

-- CreateIndex
CREATE INDEX "publications_socialAccountId_idx" ON "publications"("socialAccountId");

-- CreateIndex
CREATE INDEX "publications_platform_idx" ON "publications"("platform");

-- CreateIndex
CREATE INDEX "publications_status_idx" ON "publications"("status");

-- CreateIndex
CREATE INDEX "publications_scheduledAt_idx" ON "publications"("scheduledAt");

-- CreateIndex
CREATE INDEX "publications_deletedAt_idx" ON "publications"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_account_options_contentId_socialAccountId_key" ON "content_account_options"("contentId", "socialAccountId");

-- CreateIndex
CREATE INDEX "content_account_options_contentId_idx" ON "content_account_options"("contentId");

-- CreateIndex
CREATE INDEX "content_account_options_socialAccountId_idx" ON "content_account_options"("socialAccountId");

-- CreateIndex
CREATE INDEX "content_account_options_deletedAt_idx" ON "content_account_options"("deletedAt");

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_accounts" ADD CONSTRAINT "content_accounts_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_accounts" ADD CONSTRAINT "content_accounts_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_account_options" ADD CONSTRAINT "content_account_options_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_account_options" ADD CONSTRAINT "content_account_options_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_account_options" ADD CONSTRAINT "content_account_options_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
