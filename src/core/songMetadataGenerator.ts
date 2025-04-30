/**
 * @file songMetadataGenerator.ts
 * @description Generates song metadata using LangChain and OpenAI
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { AIMessage } from "@langchain/core/messages";
import { SongMetadata } from "../models/song";
import { Logger } from "../utils/logger";

/**
 * @class SongMetadataGenerator
 * @description Generates structured song metadata using LangChain and OpenAI
 */
export class SongMetadataGenerator {
  private chain: RunnableSequence;
  private readonly MODEL = "gpt-4-turbo-preview";

  /**
   * @constructor
   * @param {string} apiKey - OpenAI API key
   * @throws {Error} If API key is missing
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const llm = new ChatOpenAI({
      modelName: this.MODEL,
      apiKey,
      temperature: 0.7,
    });

    const promptTemplate = ChatPromptTemplate.fromTemplate(`
      You are a professional songwriter and music metadata expert. Generate complete song metadata based on this concept: {idea}
      
      If the input is empty or invalid, respond with "INVALID INPUT".
      
      For valid inputs, output a JSON object with this structure:
      {{
        "title": "A creative title (max 60 chars)",
        "lyrics": "Full lyrics with sections",
        "tags": ["genre", "style", "mood"]
      }}

      The lyrics MUST include these EXACT sections in order:
      [Verse 1]
      First verse lyrics here
      [Verse 2]
      Second verse lyrics here
      [Chorus]
      Chorus lyrics here
      [Verse 3]
      Third verse lyrics here
      [Chorus]
      Chorus lyrics here
      
      Rules:
      1. No special punctuation in title
      2. No double quotes in lyrics (use single quotes if needed)
      3. MUST include ALL required sections with EXACT labels: [Verse 1], [Verse 2], [Verse 3], [Chorus]
      4. Include performance notes in square brackets like [Soft], [Build up]
      5. Output ONLY the JSON, no explanations or additional text
      6. The JSON must be properly formatted and escaped
      7. Tags must be an array of 3-5 strings for genre, style, and mood
    `);

    this.chain = RunnableSequence.from([
      promptTemplate,
      llm,
      this.extractJson,
      new JsonOutputParser<SongMetadata>(),
    ]);
  }

  /**
   * @private
   * @method extractJson
   * @description Extracts JSON from LLM response
   */
  private extractJson = async (message: AIMessage): Promise<string> => {
    let content = "";

    if (typeof message.content === "string") {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content
        .map((c) => {
          if (typeof c === "string") return c;
          if (typeof c === "object" && c.type === "text") return c.text;
          return JSON.stringify(c);
        })
        .join("\n");
    } else if (typeof message.content === "object") {
      content = JSON.stringify(message.content);
    }

    Logger.debug(`Raw content from LLM: ${content}`);

    // Try to find JSON in code block first
    let jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1].trim();
      try {
        const parsed = JSON.parse(jsonStr); // Validate JSON
        Logger.debug(
          `Found JSON in code block: ${JSON.stringify(parsed, null, 2)}`
        );
        if (this.validateJsonStructure(parsed)) {
          return jsonStr;
        }
        Logger.debug("JSON structure validation failed");
      } catch (e) {
        const error = e as Error;
        Logger.debug(`Invalid JSON in code block: ${error.message}`);
      }
    }

    // Try to find JSON between curly braces
    jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0].trim();
      try {
        const parsed = JSON.parse(jsonStr); // Validate JSON
        Logger.debug(
          `Found JSON between curly braces: ${JSON.stringify(parsed, null, 2)}`
        );
        if (this.validateJsonStructure(parsed)) {
          return jsonStr;
        }
        Logger.debug("JSON structure validation failed");
      } catch (e) {
        const error = e as Error;
        Logger.debug(`Invalid JSON between curly braces: ${error.message}`);
        // Try to clean up common issues
        const cleaned = jsonStr
          .replace(/\n/g, " ")
          .replace(/\s+/g, " ")
          .replace(/,\s*}/g, "}");
        try {
          const parsed = JSON.parse(cleaned); // Validate cleaned JSON
          Logger.debug(
            `Found cleaned JSON: ${JSON.stringify(parsed, null, 2)}`
          );
          if (this.validateJsonStructure(parsed)) {
            return cleaned;
          }
          Logger.debug("Cleaned JSON structure validation failed");
        } catch (e) {
          const error = e as Error;
          Logger.debug(`Failed to clean up JSON: ${error.message}`);
        }
      }
    }

    throw new Error("Cannot generate song metadata from empty input");
  };

  /**
   * @private
   * @method validateJsonStructure
   * @description Validates that the parsed JSON has the correct structure
   * @param {any} json - The parsed JSON to validate
   * @returns {boolean} True if the structure is valid
   */
  private validateJsonStructure(json: any): boolean {
    if (!json || typeof json !== "object") return false;

    // Validate title
    if (typeof json.title !== "string") return false;
    if (json.title.trim() === "") return false;

    // Validate lyrics
    if (typeof json.lyrics !== "string") return false;
    if (json.lyrics.trim() === "") return false;

    // Validate tags
    if (!Array.isArray(json.tags)) return false;
    if (json.tags.length < 3 || json.tags.length > 5) return false;
    if (
      !json.tags.every(
        (tag: unknown) => typeof tag === "string" && tag.trim() !== ""
      )
    )
      return false;

    return true;
  }

  /**
   * @async
   * @method generate
   * @description Generates song metadata from a concept/idea
   * @param {string} idea - The song concept
   * @returns {Promise<SongMetadata>} Generated metadata
   * @throws {Error} If generation or validation fails
   */
  async generate(idea: string): Promise<SongMetadata> {
    if (!idea || idea.trim() === "") {
      throw new Error("Cannot generate song metadata from empty input");
    }

    try {
      Logger.debug(`Generating metadata for idea: ${idea}`);
      const metadata = await this.chain.invoke({ idea });
      this.validateMetadata(metadata);
      return metadata;
    } catch (error) {
      const message = (error as Error).message;
      Logger.debug(`Metadata generation error: ${message}`);

      if (
        message.includes("Json not found") ||
        message.includes("No valid JSON found")
      ) {
        throw new Error("Cannot generate song metadata from empty input");
      }
      if (message.includes("Title too long")) {
        throw new Error("Title too long");
      }
      throw new Error(`Error generating metadata: ${message}`);
    }
  }

  /**
   * @private
   * @method validateMetadata
   * @description Validates the generated metadata
   * @param {SongMetadata} metadata - The metadata to validate
   * @throws {Error} If validation fails
   */
  private validateMetadata(metadata: SongMetadata): void {
    if (!metadata.title?.trim()) {
      throw new Error("Invalid or missing title");
    }

    if (!metadata.lyrics?.trim()) {
      throw new Error("Invalid or missing lyrics");
    }

    if (!Array.isArray(metadata.tags) || metadata.tags.length < 3) {
      throw new Error("Invalid or insufficient tags");
    }

    if (metadata.title.length > 60) {
      throw new Error("Title too long");
    }

    // Count verses using the format [Verse X]
    const verseCount = (metadata.lyrics.match(/\[Verse \d+\]/g) || []).length;
    if (verseCount < 3) {
      throw new Error("Lyrics must contain at least 3 verses");
    }

    if (!metadata.lyrics.includes("[Chorus]")) {
      throw new Error("Lyrics must contain at least one chorus");
    }

    // Clean up tags
    metadata.tags = metadata.tags.map((tag) => tag.trim().toLowerCase());
  }
}
