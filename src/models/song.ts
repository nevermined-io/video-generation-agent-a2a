/**
 * @file song.ts
 * @description Types for song generation process
 */

/**
 * @enum SongGenerationState
 * @description States specific to the song generation process
 */
export enum SongGenerationState {
  METADATA_GENERATION = "metadata_generation",
  AUDIO_GENERATION = "audio_generation",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * @interface SongMetadata
 * @description Metadata structure for a generated song
 */
export interface SongMetadata {
  title: string;
  lyrics?: string;
  tags?: string[];
}

/**
 * @interface SongGenerationOptions
 * @description Options for song generation
 */
export interface SongGenerationOptions {
  mv?: string;
  title?: string;
  lyrics?: string;
  tags?: string[];
}

/**
 * @interface SongGenerationResult
 * @description Final result of song generation process
 */
export interface SongGenerationResult {
  jobId: string;
  music: {
    musicId: string;
    title: string;
    audioUrl: string;
    duration: number;
  };
  metadata: SongMetadata;
}
