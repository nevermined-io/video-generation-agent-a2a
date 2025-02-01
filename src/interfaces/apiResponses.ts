/**
 * @interface GenerateSongResponse
 * @description Response structure for song generation request
 * @property {string} jobId - Unique identifier for the generation job
 * @property {any} [key: string] - Additional properties from the API
 */
export interface GenerateSongResponse {
  jobId: string;
  [key: string]: any;
}

/**
 * @interface StatusResponse
 * @description Response structure for generation status check
 * @property {"SUCCESS" | "FAILED" | "PROCESSING"} status - Current job status
 * @property {number} progress - Completion percentage (0-100)
 * @property {any} data - Raw response data from the API
 */
export interface StatusResponse {
  status: "SUCCESS" | "FAILED" | "PROCESSING" | "ON_QUEUE";
  progress: number;
  data: any;
}

/**
 * @interface MusicTrack
 * @description Metadata for a generated music track
 * @property {string} musicId - Unique track identifier
 * @property {string} title - Track title
 * @property {string} audioUrl - URL to access the audio file
 * @property {number} duration - Track duration in seconds
 */
interface MusicTrack {
  musicId: string;
  title: string;
  audioUrl: string;
  duration: number;
}

/**
 * @interface SongResponse
 * @description Complete response for a generated song
 * @property {string} jobId - Original job identifier
 * @property {MusicTrack[]} musics - Array of generated tracks
 */
export interface SongResponse {
  jobId: string;
  music: MusicTrack;
}

/**
 * @interface SongOptions
 * @description Configuration options for song generation
 * @property {string} [title] - Custom title for the track
 * @property {string[]} [tags] - Style tags for the generation
 * @property {string} [gptDescriptionPrompt] - Prompt for automatic lyrics generation
 * @property {"chirp-v3-0" | "chirp-v3-5" | "chirp-v4"} [mv] - Model version to use
 */
export interface SongOptions {
  title?: string;
  tags?: string[];
  gptDescriptionPrompt?: string;
  lyrics?: string;
  mv?: "chirp-v3-0" | "chirp-v3-5" | "chirp-v4";
}
