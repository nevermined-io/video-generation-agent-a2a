/**
 * @file songMetadataGenerator.ts
 * @description Generates complete song metadata using LangChain's RunnableSequence and structured JSON output.
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { Logger } from "./utils/logger";

/**
 * Represents the complete song metadata structure
 * @interface
 * @property {string} title - Concise song title without extra punctuation
 * @property {string} lyrics - Complete lyrics including verses, chorus, and bridge
 * @property {string[]} tags - Genre/style descriptors (3-5 elements)
 */
export interface SongMetadata {
  title: string;
  lyrics: string;
  tags: string[];
}

/**
 * Generates structured song metadata using a single LLM call pipeline
 * @class
 */
export class SongMetadataGenerator {
  private chain: RunnableSequence<{ idea: string }, SongMetadata>;

  /**
   * Initializes the generator with LLM chain
   * @constructor
   * @param {string} apiKey - OpenAI API key for authentication
   * @throws {Error} If API key is missing
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required for SongMetadataGenerator.");
    }

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey,
    });

    const promptTemplate = ChatPromptTemplate.fromTemplate(`

      You are a professional songwriter and music metadata expert. Your task is to generate a complete song's metadata in STRICTLY VALID JSON format using this structure:  

      {{
        "title": "Creative song title",
        "lyrics": "Full lyrics with verses and chorus",
        "tags": ["genre", "mood"]
      }}
      
      Guidelines:  
      1. Title: Maximum 60 characters, no special punctuation.  
      2. Lyrics: Must be complete, including at least 3 verses + chorus (bridge, intro, and outros are optional but encouraged).  
      3. Tags: Provide 3-5 descriptive keywords for genre, style, and mood.  
      4. Output strictly as JSON—NO extra text, explanations, or formatting outside the JSON block.  
      
      Enhancements for Creativity & Musical Expression:  
      - Song structure clarity: Use brackets [ ] to define sections such as:  
        - [Intro] [Verse 1] [Chorus] [Bridge] [Outro]  
        - Advanced instructions: [Flute solo intro] [Crescendo] [Whispering vocals] [Screaming vocals]  
      - Emphasis through capitalization: Highlight intensity with ALL CAPS (e.g., "I CAN’T LET GO!")  
      - Sound effects using asterisks: Incorporate atmosphere with *whispering*, *gunshots*, *echo fades*, etc.  
      - Creative genre fusion: Describe unique styles, e.g., "haunting g-funk horror doom trap r&b".  
      - Workarounds for language filters: Replace sensitive words (e.g., “die” → “dye”, “kill” → “ill”).  
      
      Example Output:  
      {{
        "title": "Neon Heartbeat Symphony",
        "lyrics": "[Intro]\\n*Soft synths fading in*\\n[Verse 1]\\nCity lights are calling me home...\\n[Chorus]\\nNEON HEARTBEAT, DON'T LET ME GO!\\n[Verse 2]\\nEvery step echoes in the rain...\\n[Guitar solo]\\n[Outro]\\n*Distant echoes fading out*",
        "tags": ["synth-pop", "retro-futuristic", "dance"]
      }}
      
      Now, generate a song based on this concept: {idea}
    `);

    this.chain = RunnableSequence.from([
      promptTemplate,
      llm,
      new JsonOutputParser(),
    ]);
  }

  /**
   * Generates structured song metadata from user input
   * @async
   * @param {string} idea - User's song concept or theme
   * @returns {Promise<SongMetadata>} Structured metadata object
   * @throws {Error} If generation fails validation
   */
  async generateMetadata(idea: string): Promise<SongMetadata> {
    try {
      const metadata = await this.chain.invoke({ idea });
      Logger.info(`Generated metadata: ${JSON.stringify(metadata)}`);

      // Validate response structure
      if (!metadata?.title || !metadata?.lyrics || !metadata?.tags) {
        throw new Error("Invalid response structure from LLM");
      }

      // Validate tags array format
      if (
        !Array.isArray(metadata.tags) ||
        metadata.tags.some((t) => typeof t !== "string")
      ) {
        throw new Error("Invalid tag format in response");
      }

      // Validate lyrics length
      if (metadata.lyrics.split("\n").length < 5) {
        throw new Error("Insufficient lyrics content");
      }

      Logger.success("Metadata generation successful");
      return metadata as SongMetadata;
    } catch (error) {
      Logger.error(`Metadata generation failed: ${error}`);
      throw new Error(`Generation error: ${(error as Error).message}`);
    }
  }
}
