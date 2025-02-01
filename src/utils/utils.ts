/**
 * @file utils.ts
 * @description General utility functions for the Song Generator Agent.
 */
import axios from "axios";
import { parseBuffer } from "music-metadata";
import { Logger } from "./logger";

/**
 * @async
 * @function calculateDuration
 * @description Fetches an audio file by its URL, extracts metadata, and returns the duration in seconds.
 * @param {string} audioUrl - The direct URL to the audio file.
 * @returns {Promise<number>} The duration of the audio in seconds.
 */
export async function calculateDuration(audioUrl: string): Promise<number> {
  try {
    Logger.info("Calculating music duration...");
    const response = await axios.get(audioUrl, {
      responseType: "arraybuffer",
    });
    const metadata = await parseBuffer(response.data, "audio/mpeg");
    return Math.floor(metadata.format.duration || 0);
  } catch (error) {
    Logger.error(`Error obtaining audio duration: ${(error as Error).message}`);
    return 0;
  }
}
