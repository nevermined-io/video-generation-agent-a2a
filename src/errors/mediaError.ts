/**
 * @enum {string}
 * @description Enumeration of possible error codes for media (image/video) operations
 */
export enum MediaErrorCode {
  INVALID_API_KEY = "INVALID_API_KEY",
  INVALID_REQUEST = "INVALID_REQUEST",
  API_ERROR = "API_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  GENERATION_FAILED = "GENERATION_FAILED",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * @class MediaError
 * @description Custom error class for media-related operations
 * @extends Error
 */
export class MediaError extends Error {
  /**
   * @constructor
   * @param {MediaErrorCode} code - The error code
   * @param {number} status - HTTP status code if applicable
   * @param {string} [details] - Additional error details
   */
  constructor(
    public readonly code: MediaErrorCode,
    public readonly status: number,
    public readonly details?: string
  ) {
    super(`${code}: ${details || "An error occurred"}`);
    this.name = "MediaError";
    Object.setPrototypeOf(this, MediaError.prototype);
  }
}
