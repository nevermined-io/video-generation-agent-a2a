/**
 * @file music-metadata.ts
 * @description Mock implementation of the music-metadata module for testing purposes
 */

import { IAudioMetadata, IFormat, ICommonTagsResult } from "music-metadata";

/**
 * @interface MockAudioMetadata
 * @description Represents the structure of mock audio metadata
 */
interface MockAudioMetadata extends IAudioMetadata {
  format: IFormat;
  common: ICommonTagsResult;
}

/**
 * @function parseBuffer
 * @description Mock implementation of the parseBuffer function from music-metadata
 * @param {Buffer} buffer - The audio file buffer to parse
 * @returns {Promise<MockAudioMetadata>} A promise that resolves to mock audio metadata
 */
export const parseBuffer = jest
  .fn()
  .mockImplementation(async (buffer: Buffer): Promise<MockAudioMetadata> => {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Invalid input: buffer must be a Buffer instance");
    }

    return {
      format: {
        tagTypes: ["ID3v2.4"],
        duration: 180, // 3 minutes
        bitrate: 320000, // 320kbps
        sampleRate: 44100, // 44.1kHz
        numberOfChannels: 2,
        container: "MP3",
        codec: "mp3",
        lossless: false,
        tool: "LAME",
        trackInfo: [],
      },
      common: {
        track: { no: 1, of: 1 },
        disk: { no: 1, of: 1 },
        movementIndex: { no: 1, of: 1 },
        title: "Mock Song",
        artist: "Mock Artist",
        album: "Mock Album",
        year: 2024,
        genre: ["Pop"],
        picture: [],
      },
      quality: {
        warnings: [],
      },
      native: {},
    };
  });
