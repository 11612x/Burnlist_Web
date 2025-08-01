// Centralized logging utility with timestamps and log levels
const isDevelopment = import.meta.env.DEV;

// Log levels (higher number = more verbose)
const LOG_LEVELS = {
  ERROR: 0,   // Always shown
  WARN: 1,    // Important warnings
  INFO: 2,    // General info (API calls, major operations)
  DEBUG: 3    // Verbose debug info (calculations, renders)
};

// Set current log level (change this to control verbosity)
// ERROR: Only errors
// WARN: Errors + warnings (quiet - recommended for normal use)
// INFO: Errors + warnings + info (moderate verbosity)  
// DEBUG: Everything (very verbose - for debugging only)
const CURRENT_LOG_LEVEL = LOG_LEVELS.WARN;

/* 
🎛️ QUICK LOG LEVEL REFERENCE:

For normal use (quiet):
const CURRENT_LOG_LEVEL = LOG_LEVELS.WARN;

For API debugging:
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

For deep debugging (calculations, renders):
const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;
*/

// Format timestamp for consistent display
const getTimestamp = () => {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `${time}.${ms}`;
};

// Add timestamp prefix to message
const addTimestamp = (message) => {
  const timestamp = getTimestamp();
  if (typeof message === 'string') {
    return `[${timestamp}] ${message}`;
  }
  return `[${timestamp}]`;
};

// Check if we should log at this level
const shouldLog = (level) => {
  return isDevelopment && level <= CURRENT_LOG_LEVEL;
};

export const logger = {
  // DEBUG level - very verbose (calculations, renders, detailed flow)
  debug: (message, ...args) => {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(addTimestamp(`🔍 ${message}`), ...args);
    }
  },

  // INFO level - general information (API calls, major operations)  
  info: (message, ...args) => {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info(addTimestamp(message), ...args);
    }
  },

  // WARN level - important warnings
  warn: (message, ...args) => {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(addTimestamp(message), ...args);
    }
  },
  
  // ERROR level - always shown, even in production
  error: (message, ...args) => {
    console.error(addTimestamp(message), ...args);
  },

  // Legacy method - maps to info level
  log: (message, ...args) => {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(addTimestamp(message), ...args);
    }
  },

  // Raw console methods for when you need them without timestamps
  raw: {
    log: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => isDevelopment && console.warn(...args),
    error: (...args) => console.error(...args),
    info: (...args) => isDevelopment && console.info(...args)
  }
};

// Helper for conditional logging (deprecated, use logger.info instead)
export const devLog = (message, ...args) => {
  if (shouldLog(LOG_LEVELS.INFO)) {
    console.log(addTimestamp(message), ...args);
  }
};

// Export commonly used aliases for convenience
export const { debug, info, log, warn, error } = logger;

// Export log levels for external configuration
export { LOG_LEVELS }; 