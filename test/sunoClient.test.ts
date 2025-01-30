/**
 * @file sunoClient.test.ts
 * @description Unit tests for SunoClient methods including calculateDuration, generateSong, etc.
 */

import axios from "axios";
import { SunoClient } from "../src/clients/sunoClient";
import { Logger } from "../src/utils/logger";
import { StatusResponse } from "../src/interfaces/apiResponses";

// Mock Logger to keep console output clean
jest.mock("../src/utils/logger", () => ({
  Logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("SunoClient", () => {
  let client: SunoClient;

  beforeAll(() => {
    // Create a new SunoClient with a fake API key
    client = new SunoClient("FAKE_API_KEY");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("calculateDuration (private method)", () => {
    /**
     * @test Should return correct duration for a real audio file
     */
    it("should return the correct duration from a real audio URL", async () => {
      // We want to actually test the real audio
      // so let's un-mock axios for this test only
      jest.unmock("axios");
      const realClient = new SunoClient("FAKE_API_KEY");

      // Example of a short public MP3.
      // (File contents can change over time, so results may vary.)
      const testUrl =
        "https://cdnc.ttapi.io/2025-01-28/255e0c66-558e-40ea-abdd-7c403fb7e40a.mp3";

      // We can either make it public for test or cast to any to access.
      const duration = await (realClient as any).calculateDuration(testUrl);

      // Expect duration to be greater than 0
      expect(duration).toBeGreaterThan(0);

      // Re-mock axios for the rest of the tests
      jest.mock("axios");
    });
  });

  describe("generateSong", () => {
    /**
     * @test Should post to /music and return a jobId
     */
    it("should return a jobId when generateSong is successful", async () => {
      // Mock the axios response
      jest.spyOn(axios, "post").mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            jobId: "fakeJobId",
          },
        },
      });

      const jobId = await client.generateSong("Test prompt");
      expect(jobId).toBe("fakeJobId");
    });

    /**
     * @test Should throw error when API response is invalid
     */
    it("should throw an error if jobId is missing", async () => {
      jest.spyOn(axios, "post").mockResolvedValueOnce({
        status: 200,
        data: {
          data: {},
        },
      });

      await expect(client.generateSong("Test prompt")).rejects.toThrow(
        "Invalid API response (missing jobId)"
      );
    });
  });

  describe("checkStatus", () => {
    /**
     * @test Should return status response when successful
     */
    it("should return status response", async () => {
      const mockStatus: StatusResponse = {
        status: "PROCESSING",
        progress: 50,
        data: { progress: "50", jobId: "fakeId" },
      };

      jest.spyOn(axios, "post").mockResolvedValueOnce({
        data: mockStatus,
      });

      const result = await client.checkStatus("fakeId");
      expect(result.status).toBe("PROCESSING");
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

      await expect(client.checkStatus("fakeId")).rejects.toThrow(
        "Status check failed: Some network error"
      );
    });
  });

  describe("getSong", () => {
    /**
     * @test Should throw error if status is not SUCCESS
     */
    it("should throw if status is not SUCCESS", async () => {
      jest.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          status: "FAILED",
          progress: 0,
          data: {
            progress: "0",
            message: "Server error",
          },
        },
      });

      await expect(client.getSong("fakeId")).rejects.toThrow(
        "Song not ready. Current status: FAILED"
      );
    });
  });

  describe("waitForCompletion", () => {
    /**
     * @test Should resolve when status is SUCCESS
     */
    it("should resolve when the job status becomes SUCCESS", async () => {
      // Simulate a "PROCESSING" once, then "SUCCESS"
      jest
        .spyOn(axios, "post")
        .mockResolvedValueOnce({
          data: {
            status: "PROCESSING",
            data: { progress: "50" },
          },
        })
        .mockResolvedValueOnce({
          data: {
            status: "SUCCESS",
            data: { progress: "100" },
          },
        });

      await expect(
        client.waitForCompletion("fakeId", 10)
      ).resolves.not.toThrow();
    });

    /**
     * @test Should reject when status is FAILED
     */
    it("should reject when the job status becomes FAILED", async () => {
      jest.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          status: "FAILED",
          data: {
            message: "Server error",
          },
        },
      });

      await expect(client.waitForCompletion("fakeId", 10)).rejects.toThrow(
        "Server error"
      );
    });
  });
});
