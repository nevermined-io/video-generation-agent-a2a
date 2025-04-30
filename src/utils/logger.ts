/**
 * @file logger.ts
 * @description Simple logging utility
 */

/**
 * @class Logger
 * @description Provides logging functionality with different levels
 */
export class Logger {
  private static readonly LOG_LEVELS = {
    ERROR: "ERROR",
    WARN: "WARN",
    INFO: "INFO",
    DEBUG: "DEBUG",
  };

  /**
   * @method error
   * @description Log error messages
   */
  public static error(message: string, ...args: any[]): void {
    console.error(`[${this.LOG_LEVELS.ERROR}] ${message}`, ...args);
  }

  /**
   * @method warn
   * @description Log warning messages
   */
  public static warn(message: string, ...args: any[]): void {
    console.warn(`[${this.LOG_LEVELS.WARN}] ${message}`, ...args);
  }

  /**
   * @method info
   * @description Log info messages
   */
  public static info(message: string, ...args: any[]): void {
    console.info(`[${this.LOG_LEVELS.INFO}] ${message}`, ...args);
  }

  /**
   * @method debug
   * @description Log debug messages
   */
  public static debug(message: string, ...args: any[]): void {
    console.debug(`[${this.LOG_LEVELS.DEBUG}] ${message}`, ...args);
  }
}
