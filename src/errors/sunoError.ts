/**
 * @enum {string}
 * @description Enumeration of possible error codes for Suno operations
 */
export enum SunoErrorCode {
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
 * @class SunoError
 * @description Custom error class for Suno-related operations
 * @extends Error
 */
export class SunoError extends Error {
  /**
   * @constructor
   * @param {SunoErrorCode} code - The error code
   * @param {number} status - HTTP status code if applicable
   * @param {string} [details] - Additional error details
   */
  constructor(
    public readonly code: SunoErrorCode,
    public readonly status: number,
    public readonly details?: string
  ) {
    super(`${code}: ${details || "An error occurred"}`);
    this.name = "SunoError";
    Object.setPrototypeOf(this, SunoError.prototype);
  }
}
