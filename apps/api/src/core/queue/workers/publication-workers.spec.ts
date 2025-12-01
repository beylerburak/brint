import { describe, it, expect, vi, beforeEach } from "vitest";
import { processFacebookPublishJob } from "./publication-facebook.worker.js";
import { processInstagramPublishJob } from "./publication-instagram.worker.js";
import { publicationRepository } from "../../../modules/publication/publication.repository.js";
import { logActivity } from "../../../modules/activity/activity.service.js";
import { decryptSocialCredentials } from "../../../modules/social-account/social-account.types.js";
import { facebookPublicationClient } from "../../../modules/publication/providers/facebook-publication.client.js";
import { instagramPublicationClient } from "../../../modules/publication/providers/instagram-publication.client.js";

// Mock dependencies
vi.mock("../../../modules/publication/publication.repository.js", () => ({
    publicationRepository: {
        getPublicationWithRelations: vi.fn(),
        updatePublicationStatus: vi.fn(),
    },
}));

vi.mock("../../../modules/activity/activity.service.js", () => ({
    logActivity: vi.fn(),
}));

vi.mock("../../../modules/social-account/social-account.types.js", () => ({
    decryptSocialCredentials: vi.fn(),
}));

vi.mock("../../../modules/publication/providers/facebook-publication.client.js", () => ({
    facebookPublicationClient: {
        publishPhoto: vi.fn(),
        publishVideo: vi.fn(),
        publishCarousel: vi.fn(),
        publishLink: vi.fn(),
        publishStory: vi.fn(),
    },
}));

vi.mock("../../../modules/publication/providers/instagram-publication.client.js", () => ({
    instagramPublicationClient: {
        publishImage: vi.fn(),
        publishCarousel: vi.fn(),
        publishReel: vi.fn(),
        publishStory: vi.fn(),
    },
}));

vi.mock("../../observability/sentry.js", () => ({
    captureException: vi.fn(),
    isSentryInitialized: vi.fn().mockReturnValue(false),
}));

vi.mock("../../../lib/logger.js", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("Publication Workers", () => {
    const mockJob = {
        id: "job-123",
        data: {
            publicationId: "pub-123",
            workspaceId: "ws-123",
        },
    } as any;

    const mockPublication = {
        id: "pub-123",
        status: "scheduled",
        socialAccount: {
            id: "sa-123",
            credentialsEncrypted: "encrypted-creds",
            platformData: {
                pageId: "page-123",
                igBusinessAccountId: "ig-123",
            },
        },
        brand: {
            name: "Test Brand",
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Facebook Worker", () => {
        it("should process PHOTO publication successfully", async () => {
            // Setup mocks
            vi.mocked(publicationRepository.getPublicationWithRelations).mockResolvedValue({
                ...mockPublication,
                payloadJson: {
                    contentType: "PHOTO",
                    imageMediaId: "media-1",
                    message: "Test photo",
                },
            } as any);

            vi.mocked(decryptSocialCredentials).mockReturnValue({
                platform: "FACEBOOK_PAGE",
                data: { accessToken: "fb-token", pageId: "page-123" },
            });

            vi.mocked(facebookPublicationClient.publishPhoto).mockResolvedValue({
                postId: "fb-post-1",
                permalink: "http://fb.com/post/1",
            });

            // Execute
            await processFacebookPublishJob(mockJob);

            // Verify
            expect(publicationRepository.getPublicationWithRelations).toHaveBeenCalledWith("pub-123");
            expect(decryptSocialCredentials).toHaveBeenCalledWith("encrypted-creds");
            expect(publicationRepository.updatePublicationStatus).toHaveBeenCalledWith("pub-123", {
                status: "publishing",
                jobId: "job-123",
            });
            expect(facebookPublicationClient.publishPhoto).toHaveBeenCalledWith(
                "page-123",
                expect.objectContaining({ contentType: "PHOTO", imageMediaId: "media-1" }),
                "fb-token"
            );
            expect(publicationRepository.updatePublicationStatus).toHaveBeenCalledWith("pub-123", expect.objectContaining({
                status: "published",
                externalPostId: "fb-post-1",
                permalink: "http://fb.com/post/1",
            }));
            expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
                type: "publication.published",
                scopeId: "pub-123",
            }));
        });

        it("should handle failure gracefully", async () => {
            // Setup mocks
            vi.mocked(publicationRepository.getPublicationWithRelations).mockResolvedValue({
                ...mockPublication,
                payloadJson: {
                    contentType: "PHOTO",
                    imageMediaId: "media-1",
                },
            } as any);

            vi.mocked(decryptSocialCredentials).mockReturnValue({
                platform: "FACEBOOK_PAGE",
                data: { accessToken: "fb-token", pageId: "page-123" },
            });

            vi.mocked(facebookPublicationClient.publishPhoto).mockRejectedValue(new Error("FB API Error"));

            // Execute & Verify
            await expect(processFacebookPublishJob(mockJob)).rejects.toThrow("FB API Error");

            expect(publicationRepository.updatePublicationStatus).toHaveBeenCalledWith("pub-123", expect.objectContaining({
                status: "failed",
                providerResponseJson: expect.objectContaining({ error: "FB API Error" }),
            }));
            expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
                type: "publication.failed",
                scopeId: "pub-123",
            }));
        });
    });

    describe("Instagram Worker", () => {
        it("should process IMAGE publication successfully", async () => {
            // Setup mocks
            vi.mocked(publicationRepository.getPublicationWithRelations).mockResolvedValue({
                ...mockPublication,
                payloadJson: {
                    contentType: "IMAGE",
                    imageMediaId: "media-1",
                    caption: "Test IG image",
                },
            } as any);

            vi.mocked(decryptSocialCredentials).mockReturnValue({
                platform: "INSTAGRAM_BUSINESS",
                data: { accessToken: "ig-token", igBusinessAccountId: "ig-123" },
            });

            vi.mocked(instagramPublicationClient.publishImage).mockResolvedValue({
                containerId: "cont-1",
                mediaId: "ig-media-1",
                permalink: "http://instagr.am/p/1",
            });

            // Execute
            await processInstagramPublishJob(mockJob);

            // Verify
            expect(publicationRepository.getPublicationWithRelations).toHaveBeenCalledWith("pub-123");
            expect(decryptSocialCredentials).toHaveBeenCalledWith("encrypted-creds");
            expect(publicationRepository.updatePublicationStatus).toHaveBeenCalledWith("pub-123", {
                status: "publishing",
                jobId: "job-123",
            });
            expect(instagramPublicationClient.publishImage).toHaveBeenCalledWith(
                "ig-123",
                expect.objectContaining({ contentType: "IMAGE", imageMediaId: "media-1" }),
                "ig-token"
            );
            expect(publicationRepository.updatePublicationStatus).toHaveBeenCalledWith("pub-123", expect.objectContaining({
                status: "published",
                externalPostId: "ig-media-1",
                permalink: "http://instagr.am/p/1",
            }));
            expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
                type: "publication.published",
                scopeId: "pub-123",
            }));
        });

        it("should process REEL publication successfully", async () => {
            // Setup mocks
            vi.mocked(publicationRepository.getPublicationWithRelations).mockResolvedValue({
                ...mockPublication,
                payloadJson: {
                    contentType: "REEL",
                    videoMediaId: "media-vid-1",
                    caption: "Test IG reel",
                },
            } as any);

            vi.mocked(decryptSocialCredentials).mockReturnValue({
                platform: "INSTAGRAM_BUSINESS",
                data: { accessToken: "ig-token", igBusinessAccountId: "ig-123" },
            });

            vi.mocked(instagramPublicationClient.publishReel).mockResolvedValue({
                containerId: "cont-reel-1",
                mediaId: "ig-reel-1",
                permalink: "http://instagr.am/reel/1",
            });

            // Execute
            await processInstagramPublishJob(mockJob);

            // Verify
            expect(instagramPublicationClient.publishReel).toHaveBeenCalledWith(
                "ig-123",
                expect.objectContaining({ contentType: "REEL", videoMediaId: "media-vid-1" }),
                "ig-token"
            );
        });
    });
});
