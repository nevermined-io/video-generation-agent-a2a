/**
 * @file sunoClient.test.ts
 * @description Unit tests for SunoClient methods including calculateDuration, generateSong, etc.
 */

import axios from "axios";
import { SunoClient } from "../../src/clients/sunoClient";
import { StatusResponse } from "../../src/interfaces/apiResponses";
import { GenerateSongResponse } from "../../src/interfaces/apiResponses";
import { SongResponse } from "../../src/interfaces/apiResponses";
import { SunoError, SunoErrorCode } from "../../src/errors/sunoError";
import { SongGenerationOptions } from "../../src/interfaces/apiResponses";
import { StatusData } from "../../src/interfaces/apiResponses";

// Mock Logger to keep console output clean
jest.mock("../../src/utils/logger", () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock audio duration calculation
jest.mock("../../src/utils/audio", () => ({
  calculateDuration: jest.fn().mockResolvedValue(180), // Mock 3 minutes duration
}));

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("SunoClient", () => {
  let client: SunoClient;
  const FAKE_API_KEY = "test-suno-key";

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SunoClient({ apiKey: FAKE_API_KEY });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  /**
   * @test Constructor Tests
   * @description Tests for SunoClient constructor
   */
  describe("Constructor", () => {
    it("should throw error when API key is not provided", () => {
      expect(() => new SunoClient({ apiKey: "" })).toThrow(SunoError);
    });

    it("should initialize with valid API key", () => {
      const testClient = new SunoClient({ apiKey: FAKE_API_KEY });
      expect(testClient).toBeInstanceOf(SunoClient);
    });

    it("should use default values for optional parameters", () => {
      const testClient = new SunoClient({ apiKey: FAKE_API_KEY });
      expect((testClient as any).baseUrl).toBe("https://api.ttapi.io/suno/v1");
      expect((testClient as any).defaultTimeout).toBe(30000);
    });

    it("should use custom baseUrl and timeout", () => {
      const customBaseUrl = "https://custom.api.com";
      const customTimeout = 10000;
      const customClient = new SunoClient({
        apiKey: FAKE_API_KEY,
        baseUrl: customBaseUrl,
        timeout: customTimeout,
      });
      expect((customClient as any).baseUrl).toBe(customBaseUrl);
      expect((customClient as any).defaultTimeout).toBe(customTimeout);
    });
  });

  /**
   * @test Song Generation
   * @description Tests for song generation functionality
   */
  describe("generateSong", () => {
    /**
     * @test Should post to /songs/generate with default options
     */
    it("should use default options when none provided", async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const songOptions = {
        prompt: "Test prompt",
        title: "Generated Song",
        tags: ["pop"],
      };

      const result = await client.generateSong("test-task-id", songOptions);
      expect(result.id).toBe("test-task-id");
      expect(result.status).toBe("completed");

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/music"),
        expect.objectContaining({
          prompt: undefined,
          title: "Generated Song",
          tags: "pop",
        }),
        expect.any(Object)
      );
    });

    /**
     * @test Should post to /songs/generate with custom options
     */
    it("should use provided options when available", async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const songOptions = {
        prompt: "Test prompt",
        title: "Custom Title",
        lyrics: "Custom lyrics",
        tags: ["rock", "indie"],
      };

      const result = await client.generateSong("test-task-id", songOptions);
      expect(result.id).toBe("test-task-id");
      expect(result.status).toBe("completed");

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/music"),
        expect.objectContaining({
          prompt: "Custom lyrics",
          title: "Custom Title",
          tags: "rock,indie",
        }),
        expect.any(Object)
      );
    });

    /**
     * @test Should throw error when API response is invalid
     */
    it("should throw an error if response is invalid", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {},
      });

      await expect(
        client.generateSong("test-task-id", { prompt: "Test prompt" })
      ).rejects.toThrow(SunoError);
    });

    /**
     * @test Should handle network errors gracefully
     */
    it("should handle network errors gracefully", async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: "Network error",
          },
        },
      });

      await expect(
        client.generateSong("test-task-id", { prompt: "Test prompt" })
      ).rejects.toThrow(SunoError);
      await expect(
        client.generateSong("test-task-id", { prompt: "Test prompt" })
      ).rejects.toMatchObject({
        code: SunoErrorCode.NETWORK_ERROR,
        status: 500,
      });
    });

    it("should throw error when prompt is empty", async () => {
      await expect(
        client.generateSong("test-task-id", { prompt: "" })
      ).rejects.toThrow(SunoError);
      await expect(
        client.generateSong("test-task-id", { prompt: "" })
      ).rejects.toMatchObject({
        code: SunoErrorCode.INVALID_REQUEST,
      });
    });

    it("should handle API specific errors", async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: "Unknown error",
          },
        },
      });

      await expect(
        client.generateSong("test-task-id", { prompt: "test" })
      ).rejects.toMatchObject({
        code: SunoErrorCode.UNKNOWN_ERROR,
        status: 500,
      });
    });
  });

  /**
   * @test Status Checking
   * @description Tests for status checking functionality
   */
  describe("checkStatus", () => {
    /**
     * @test Should return status response
     */
    it("should return status response", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("fakeId", { prompt: "Test prompt" });

      const mockStatus = {
        status: 200,
        data: {
          status: "PROCESSING",
          data: {
            jobId: "fakeJobId",
            progress: 50,
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockStatus);

      const result = await client.checkStatus("fakeId");
      expect(result.status).toBe("working");
      expect(result.progress).toBe(50);
    });

    /**
     * @test Should throw error when checkStatus fails
     */
    it("should throw error on checkStatus failure", async () => {
      jest.spyOn(axios, "post").mockRejectedValueOnce({
        response: { data: { message: "Error" } },
        message: "Some network error",
      });

      await expect(client.checkStatus("fakeId")).rejects.toThrow(SunoError);
    });

    /**
     * @test Should handle missing progress data
     */
    it("should handle missing progress data", async () => {
      jest.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          status: "PROCESSING",
          data: {},
        },
      });

      await expect(client.checkStatus("fakeId")).rejects.toThrow(SunoError);
    });

    it("should throw error when taskId is empty", async () => {
      await expect(client.checkStatus("")).rejects.toThrow(SunoError);
      await expect(client.checkStatus("")).rejects.toMatchObject({
        code: SunoErrorCode.INVALID_REQUEST,
      });
    });

    it("should handle API specific errors", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("test-id", { prompt: "Test prompt" });

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: "Task not found",
          },
        },
      });

      await expect(client.checkStatus("test-id")).rejects.toMatchObject({
        code: SunoErrorCode.NETWORK_ERROR,
        status: 500,
      });
    });
  });

  /**
   * @test Song Retrieval
   * @description Tests for song retrieval functionality
   */
  describe("getSong", () => {
    /**
     * @test Should return song data when available
     */
    it("should return song data when available", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("fakeId", { prompt: "Test prompt" });

      const mockSongResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
            musics: [
              {
                musicId: "test-music-id",
                title: "Test Song",
                audioUrl: "https://example.com/song.mp3",
              },
            ],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockSongResponse);

      const result = await client.getSong("fakeId");
      expect(result.jobId).toBe("fakeJobId");
      expect(result.music.audioUrl).toBe("https://example.com/song.mp3");
      expect(result.music.title).toBe("Test Song");
    });

    /**
     * @test Should handle network errors
     */
    it("should handle network errors gracefully", async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: "Network error",
          },
        },
      });

      await expect(client.getSong("fakeId")).rejects.toThrow(SunoError);
      await expect(client.getSong("fakeId")).rejects.toMatchObject({
        code: SunoErrorCode.NETWORK_ERROR,
        status: 500,
      });
    });

    it("should throw error when taskId is empty", async () => {
      await expect(client.getSong("")).rejects.toThrow(SunoError);
      await expect(client.getSong("")).rejects.toMatchObject({
        code: SunoErrorCode.INVALID_REQUEST,
      });
    });

    it("should handle API specific errors", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("test-id", { prompt: "Test prompt" });

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: "Song not found",
          },
        },
      });

      await expect(client.getSong("test-id")).rejects.toMatchObject({
        code: SunoErrorCode.UNKNOWN_ERROR,
        status: 500,
      });
    });
  });

  /**
   * @test Completion Waiting
   * @description Tests for waitForCompletion functionality
   */
  describe("waitForCompletion", () => {
    /**
     * @test Should resolve when status becomes SUCCESS
     */
    it("should resolve when status becomes SUCCESS", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("fakeId", { prompt: "Test prompt" });

      const mockResponses = [
        {
          status: 200,
          data: {
            status: "PROCESSING",
            data: {
              jobId: "fakeJobId",
              progress: 50,
            },
          },
        },
        {
          status: 200,
          data: {
            status: "SUCCESS",
            data: {
              jobId: "fakeJobId",
              musics: [
                {
                  musicId: "music-1",
                  title: "Test Song",
                  audioUrl: "http://example.com/audio.mp3",
                },
              ],
            },
          },
        },
      ];

      mockedAxios.get
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[1]); // Para getSong

      const generator = client.waitForCompletion("fakeId", {
        timeout: 1000,
        interval: 10,
      });

      const result = await generator.next();
      expect((result.value as StatusData).status).toBe("working");
      expect((result.value as StatusData).progress).toBe(50);

      const finalResult = await generator.next();
      expect((finalResult.value as SongResponse).music.musicId).toBe("music-1");
      expect((finalResult.value as SongResponse).music.title).toBe("Test Song");
    });

    /**
     * @test Should reject when status becomes FAILED
     */
    it("should reject when status becomes FAILED", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("fakeId", { prompt: "Test prompt" });

      const mockStatus = {
        status: 200,
        data: {
          status: "FAILED",
          data: {
            jobId: "fakeJobId",
            error: "Generation failed",
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockStatus);

      const generator = client.waitForCompletion("fakeId", {
        timeout: 1000,
        interval: 10,
      });

      await expect(generator.next()).rejects.toThrow(SunoError);
    });

    /**
     * @test Should reject when status becomes CANCELLED
     */
    it("should reject when status becomes CANCELLED", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("fakeId", { prompt: "Test prompt" });

      const mockStatus = {
        status: 200,
        data: {
          status: "FAILED",
          data: {
            jobId: "fakeJobId",
            error: "Generation cancelled",
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockStatus);

      const generator = client.waitForCompletion("fakeId", {
        timeout: 1000,
        interval: 10,
      });

      await expect(generator.next()).rejects.toThrow(SunoError);
    });

    /**
     * @test Should handle network errors during polling
     */
    it("should handle network errors during polling", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("fakeId", { prompt: "Test prompt" });

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: "Network error",
          },
        },
      });

      const generator = client.waitForCompletion("fakeId", {
        timeout: 1000,
        interval: 10,
      });

      await expect(generator.next()).rejects.toThrow(SunoError);
    });

    it("should throw error when taskId is empty", async () => {
      const generator = client.waitForCompletion("");
      await expect(generator.next()).rejects.toMatchObject({
        code: SunoErrorCode.INVALID_REQUEST,
      });
    });

    it("should handle timeout correctly", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("test-id", { prompt: "Test prompt" });

      const startTime = Date.now();
      const mockNow = jest.spyOn(Date, "now");
      mockNow
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(startTime + 6000);

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status: "PROCESSING",
          data: {
            jobId: "fakeJobId",
            progress: 50,
          },
        },
      });

      const generator = client.waitForCompletion("test-id", { timeout: 5000 });
      await expect(generator.next()).rejects.toMatchObject({
        code: SunoErrorCode.TIMEOUT,
      });

      mockNow.mockRestore();
    });

    it("should call onStatusUpdate with different states", async () => {
      // First generate a song to create the taskId -> jobId mapping
      const generateMockResponse = {
        status: 200,
        data: {
          status: "SUCCESS",
          data: {
            jobId: "fakeJobId",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(generateMockResponse);
      await client.generateSong("test-id", { prompt: "Test prompt" });

      const onStatusUpdate = jest.fn();
      const responses = [
        {
          status: 200,
          data: {
            status: "PROCESSING",
            data: {
              jobId: "test-id",
              progress: 25,
            },
          },
        },
        {
          status: 200,
          data: {
            status: "PROCESSING",
            data: {
              jobId: "test-id",
              progress: 75,
            },
          },
        },
        {
          status: 200,
          data: {
            status: "SUCCESS",
            data: {
              jobId: "test-id",
              musics: [
                {
                  musicId: "music-1",
                  title: "Test Song",
                  audioUrl: "http://example.com/audio.mp3",
                },
              ],
            },
          },
        },
      ];

      mockedAxios.get
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2])
        .mockResolvedValueOnce(responses[2]); // Para getSong

      const generator = client.waitForCompletion("test-id", {
        timeout: 5000,
        onStatusUpdate,
        interval: 10,
      });

      await generator.next();
      await generator.next();
      await generator.next();

      expect(onStatusUpdate).toHaveBeenCalledTimes(3);
      expect(onStatusUpdate).toHaveBeenNthCalledWith(1, responses[0].data.data);
      expect(onStatusUpdate).toHaveBeenNthCalledWith(2, responses[1].data.data);
      expect(onStatusUpdate).toHaveBeenNthCalledWith(3, responses[2].data.data);
    });
  });
});
