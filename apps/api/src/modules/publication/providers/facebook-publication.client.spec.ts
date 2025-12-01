import { describe, it, expect, vi, beforeEach } from "vitest";
import { facebookPublicationClient } from "./facebook-publication.client.js";
import * as graphApiUtils from "../../../core/queue/workers/graph-api.utils.js";
import * as sharedMediaUtil from "./shared-media.util.js";

// Mock dependencies
vi.mock("../../../core/queue/workers/graph-api.utils.js", async (importOriginal) => {
    const actual = await importOriginal<typeof graphApiUtils>();
    return {
        ...actual,
        graphPost: vi.fn(),
        graphPostJson: vi.fn(),
        graphGet: vi.fn(),
        verifyFacebookPostPublished: vi.fn(),
    };
});

vi.mock("./shared-media.util.js", () => ({
    getMediaPublicUrl: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock("../../../config/env.js", () => ({
    env: {
        FACEBOOK_APP_ID: "test-app-id",
    },
}));

describe("Facebook Publication Client", () => {
    const mockPageId = "page-123";
    const mockAccessToken = "access-token-123";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("publishCarousel", () => {
        it("should publish carousel using graphPostJson with attached_media array", async () => {
            // Setup
            const payload = {
                contentType: "CAROUSEL" as const,
                items: [
                    { mediaId: "media-1", type: "IMAGE" as const },
                    { mediaId: "media-2", type: "IMAGE" as const },
                ],
                message: "Test Carousel",
            };

            // Mock media URLs
            vi.mocked(sharedMediaUtil.getMediaPublicUrl).mockResolvedValueOnce("https://example.com/img1.jpg");
            vi.mocked(sharedMediaUtil.getMediaPublicUrl).mockResolvedValueOnce("https://example.com/img2.jpg");

            // Mock photo uploads (using graphPost)
            vi.mocked(graphApiUtils.graphPost).mockResolvedValueOnce({ id: "photo-1" });
            vi.mocked(graphApiUtils.graphPost).mockResolvedValueOnce({ id: "photo-2" });

            // Mock feed post (using graphPost)
            vi.mocked(graphApiUtils.graphPost).mockResolvedValueOnce({ id: "post-123" });

            // Mock verification
            vi.mocked(graphApiUtils.verifyFacebookPostPublished).mockResolvedValue({
                exists: true,
                permalink: "http://fb.com/post/123",
            });

            // Execute
            const result = await facebookPublicationClient.publishCarousel(mockPageId, payload, mockAccessToken);

            // Verify
            // 1. Check photo uploads
            expect(graphApiUtils.graphPost).toHaveBeenCalledTimes(3);
            expect(graphApiUtils.graphPost).toHaveBeenCalledWith(
                `/${mockPageId}/photos`,
                expect.objectContaining({ url: "https://example.com/img1.jpg", published: false }),
                mockAccessToken
            );

            // 2. Check feed post - MUST use graphPost with stringified attached_media array
            expect(graphApiUtils.graphPost).toHaveBeenNthCalledWith(
                3,
                `/${mockPageId}/feed`,
                {
                    published: true,
                    message: "Test Carousel",
                    attached_media: JSON.stringify([
                        { media_fbid: "photo-1" },
                        { media_fbid: "photo-2" },
                    ]),
                },
                mockAccessToken
            );

            // 3. Check result
            expect(result).toEqual({
                postId: "post-123",
                permalink: "http://fb.com/post/123",
            });
        });
    });
});
