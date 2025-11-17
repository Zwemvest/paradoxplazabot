/**
 * Logging Utility
 * Feature 10005: Devvit Native Logging
 * Feature 10006: Structured Logging Format
 *
 * Centralized logging with consistent formatting and context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  service?: string;
  postId?: string;
  commentId?: string;
  userId?: string;
  subreddit?: string;
  action?: string;
  jobId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Structured log entry for JSON output
 * Feature 10006: Structured Logging Format
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Logging configuration
 */
interface LoggerConfig {
  format: 'text' | 'json';
  minLevel: LogLevel;
}

// Default configuration - can be overridden
let config: LoggerConfig = {
  format: 'json', // Feature 10006: Default to structured JSON logging
  minLevel: 'info',
};

/**
 * Configure global logger settings
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...config };
}

/**
 * Check if log level should be emitted
 */
function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(config.minLevel);
  const messageLevelIndex = levels.indexOf(level);
  return messageLevelIndex >= currentLevelIndex;
}

/**
 * Feature 10006: Format log as structured JSON
 */
function formatJSON(
  level: LogLevel,
  service: string,
  message: string,
  context?: LogContext,
  error?: Error
): string {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
  };

  if (context) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      message: error.message,
      stack: error.stack,
    };
  }

  return JSON.stringify(entry);
}

/**
 * Format log message as human-readable text
 */
function formatText(level: LogLevel, service: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${service}]${contextStr} ${message}`;
}

/**
 * Core logging function
 */
function log(level: LogLevel, service: string, message: string, context?: LogContext, error?: Error): void {
  // Check if this log level should be emitted
  if (!shouldLog(level)) {
    return;
  }

  // Format message based on configuration
  const formattedMessage = config.format === 'json'
    ? formatJSON(level, service, message, context, error)
    : formatText(level, service, message, context);

  // Output to appropriate console method
  switch (level) {
    case 'debug':
      console.log(formattedMessage);
      break;
    case 'info':
      console.log(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'error':
      console.error(formattedMessage);
      break;
  }
}

/**
 * Logger class for service-specific logging
 */
export class Logger {
  constructor(private serviceName: string) {}

  debug(message: string, context?: LogContext): void {
    log('debug', this.serviceName, message, context);
  }

  info(message: string, context?: LogContext): void {
    log('info', this.serviceName, message, context);
  }

  warn(message: string, context?: LogContext): void {
    log('warn', this.serviceName, message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    // Feature 10006: Pass error object directly for structured logging
    const errorObj = error instanceof Error ? error : undefined;

    // If error is not an Error instance, add it to context
    const errorContext: LogContext = error && !(error instanceof Error)
      ? { ...context, errorValue: String(error) }
      : context || {};

    log('error', this.serviceName, message, errorContext, errorObj);
  }

  /**
   * Log with custom context that will be included in all subsequent logs
   */
  withContext(context: LogContext): Logger {
    return new ContextLogger(this.serviceName, context);
  }
}

/**
 * Logger with preset context
 */
class ContextLogger extends Logger {
  constructor(serviceName: string, private baseContext: LogContext) {
    super(serviceName);
  }

  debug(message: string, context?: LogContext): void {
    super.debug(message, { ...this.baseContext, ...context });
  }

  info(message: string, context?: LogContext): void {
    super.info(message, { ...this.baseContext, ...context });
  }

  warn(message: string, context?: LogContext): void {
    super.warn(message, { ...this.baseContext, ...context });
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    super.error(message, error, { ...this.baseContext, ...context });
  }
}

/**
 * Create a logger for a specific service
 */
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}

/**
 * Pre-configured loggers for each service
 */
export const loggers = {
  postValidation: createLogger('PostValidation'),
  commentValidation: createLogger('CommentValidation'),
  warningSystem: createLogger('WarningSystem'),
  removalSystem: createLogger('RemovalSystem'),
  reinstatementSystem: createLogger('ReinstatementSystem'),
  modmailHandler: createLogger('ModmailHandler'),
  notificationService: createLogger('NotificationService'),
  postState: createLogger('PostState'),
  main: createLogger('Main'),
};
