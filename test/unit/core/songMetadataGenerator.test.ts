/**
 * @file songMetadataGenerator.test.ts
 * @description Tests for SongMetadataGenerator
 */

import { describe, expect, it, beforeAll } from "@jest/globals";
import { SongMetadataGenerator } from "../../../src/core/songMetadataGenerator";

describe("SongMetadataGenerator", () => {
  let generator: SongMetadataGenerator;

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("Skipping OpenAI tests - API key not found in environment");
      return;
    }
    generator = new SongMetadataGenerator(process.env.OPENAI_API_KEY);
  });

  describe("Constructor", () => {
    it("should throw error if API key is missing", () => {
      expect(() => new SongMetadataGenerator("")).toThrow(
        "OpenAI API key is required"
      );
    });
  });

  describe("OpenAI Integration", () => {
    const itif = process.env.OPENAI_API_KEY ? it : it.skip;

    itif(
      "should successfully generate metadata using OpenAI",
      async () => {
        const prompt =
          "Generate a happy pop song about summer days at the beach";

        const metadata = await generator.generate(prompt);

        // Verificar estructura del metadata
        expect(metadata).toHaveProperty("title");
        expect(metadata).toHaveProperty("lyrics");
        expect(metadata).toHaveProperty("tags");

        // Verificar contenido
        expect(metadata.title?.length).toBeLessThanOrEqual(60);
        expect(metadata.lyrics).toBeDefined();
        expect(metadata.tags).toBeDefined();
        expect(metadata.lyrics).toContain("[Verse 1]");
        expect(metadata.lyrics).toContain("[Chorus]");
        expect(metadata.tags?.length).toBeGreaterThanOrEqual(3);

        // Verificar que el contenido es relevante al prompt
        const lowerLyrics = metadata.lyrics?.toLowerCase() || "";
        expect(
          lowerLyrics.includes("beach") ||
            lowerLyrics.includes("summer") ||
            lowerLyrics.includes("sun")
        ).toBe(true);
      },
      30000
    ); // 30 segundos de timeout

    itif(
      "should handle invalid prompts gracefully",
      async () => {
        await expect(generator.generate("")).rejects.toThrow();
      },
      30000
    ); // 30 segundos de timeout
  });
});
