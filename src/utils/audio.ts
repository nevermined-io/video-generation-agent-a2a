/**
 * @file audio.ts
 * @description Utility functions for handling audio files and metadata
 */

import axios from "axios";
import { parseBuffer } from "music-metadata";
import { Logger } from "./logger";

/**
 * @function calculateDuration
 * @description Calculates the duration of an audio file from a URL
 * @param {string} url - URL of the audio file
 * @returns {Promise<number>} Duration in seconds
 * @throws {Error} If duration calculation fails
 */
export async function calculateDuration(url: string): Promise<number> {
  try {
    Logger.info("Calculating music duration...");
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });
    const metadata = await parseBuffer(response.data, "audio/mpeg");
    return Math.floor(metadata.format.duration || 0);
  } catch (error) {
    Logger.error(`Error calculating duration: ${(error as Error).message}`);
    throw new Error(
      `Failed to calculate audio duration: ${(error as Error).message}`
    );
  }
}
