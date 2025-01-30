/**
 * @class Logger
 * @description Provides standardized logging functionality with colors
 */
export class Logger {
  private static colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
  };

  /**
   * @static
   * @method info
   * @description Log informational messages
   * @param {string} message - Message to log
   */
  static info(message: string): void {
    console.log(`${this.colors.cyan}[INFO]${this.colors.reset} ${message}`);
  }

  /**
   * @static
   * @method success
   * @description Log success messages
   * @param {string} message - Message to log
   */
  static success(message: string): void {
    console.log(`${this.colors.green}[SUCCESS]${this.colors.reset} ${message}`);
  }

  /**
   * @static
   * @method warn
   * @description Log warning messages
   * @param {string} message - Message to log
   */
  static warn(message: string): void {
    console.warn(`${this.colors.yellow}[WARN]${this.colors.reset} ${message}`);
  }

  /**
   * @static
   * @method error
   * @description Log error messages
   * @param {string} message - Message to log
   */
  static error(message: string): void {
    console.error(`${this.colors.red}[ERROR]${this.colors.reset} ${message}`);
  }
}
