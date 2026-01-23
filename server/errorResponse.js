/**
 * Unified Error Response Helper for DreamCore V2
 *
 * Provides consistent error formatting for both HTTP API and WebSocket responses.
 *
 * HTTP API Format:
 * {
 *   status: "error",
 *   error: {
 *     code: "NOT_FOUND",
 *     message: "Project not found"
 *   }
 * }
 *
 * WebSocket Format:
 * {
 *   type: "error",
 *   error: {
 *     code: "NOT_AUTHENTICATED",
 *     message: "Authentication required"
 *   }
 * }
 *
 * Migration Notes:
 * - For backward compatibility, error.message is always included
 * - Static file 404s (e.g., /user-assets/*) remain plain text
 * - Gradually migrate existing handlers to use these helpers
 */

// Standard error codes
const ErrorCodes = {
  // Authentication & Authorization
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_ID_FORMAT: 'INVALID_ID_FORMAT',
  MISSING_PARAMETER: 'MISSING_PARAMETER',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',

  // Rate limiting
  USER_LIMIT_EXCEEDED: 'USER_LIMIT_EXCEEDED',
  SYSTEM_LIMIT_EXCEEDED: 'SYSTEM_LIMIT_EXCEEDED',
  WEEKLY_LIMIT_EXCEEDED: 'WEEKLY_LIMIT_EXCEEDED',

  // Operation errors
  OPERATION_FAILED: 'OPERATION_FAILED',
  JOB_ALREADY_ACTIVE: 'JOB_ALREADY_ACTIVE',
  JOB_TIMEOUT: 'JOB_TIMEOUT',

  // File errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

// HTTP status code mapping
const HttpStatusMap = {
  [ErrorCodes.NOT_AUTHENTICATED]: 401,
  [ErrorCodes.ACCESS_DENIED]: 403,
  [ErrorCodes.INVALID_TOKEN]: 401,
  [ErrorCodes.INVALID_REQUEST]: 400,
  [ErrorCodes.INVALID_ID_FORMAT]: 400,
  [ErrorCodes.MISSING_PARAMETER]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.PROJECT_NOT_FOUND]: 404,
  [ErrorCodes.ASSET_NOT_FOUND]: 404,
  [ErrorCodes.JOB_NOT_FOUND]: 404,
  [ErrorCodes.USER_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.SYSTEM_LIMIT_EXCEEDED]: 503,
  [ErrorCodes.WEEKLY_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.OPERATION_FAILED]: 500,
  [ErrorCodes.JOB_ALREADY_ACTIVE]: 409,
  [ErrorCodes.JOB_TIMEOUT]: 504,
  [ErrorCodes.FILE_TOO_LARGE]: 413,
  [ErrorCodes.INVALID_FILE_TYPE]: 415,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.DATABASE_ERROR]: 500
};

/**
 * Create a standardized error object
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - Human-readable error message
 * @returns {Object} Standardized error object
 */
const createError = (code, message) => ({
  code,
  message
});

/**
 * Send HTTP API error response
 * @param {Object} res - Express response object
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - Human-readable error message
 * @param {number} statusOverride - Optional HTTP status code override
 */
const sendHttpError = (res, code, message, statusOverride = null) => {
  const status = statusOverride || HttpStatusMap[code] || 500;
  res.status(status).json({
    status: 'error',
    error: createError(code, message)
  });
};

/**
 * Create WebSocket error message
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - Human-readable error message
 * @returns {Object} WebSocket error message object
 */
const createWsError = (code, message) => ({
  type: 'error',
  error: createError(code, message)
});

/**
 * Express middleware for catching unhandled errors
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const errorMiddleware = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Check for known error types
  if (err.code && ErrorCodes[err.code]) {
    sendHttpError(res, err.code, err.message);
    return;
  }

  // Default to internal error
  sendHttpError(res, ErrorCodes.INTERNAL_ERROR, 'An internal error occurred');
};

/**
 * Helper to convert legacy error format to new format
 * For gradual migration of existing code
 * @param {Object} legacyError - Legacy error { error: "message" } or { error: "message", success: false }
 * @returns {Object} New format error
 */
const fromLegacyError = (legacyError) => {
  const message = legacyError.error || legacyError.message || 'Unknown error';

  // Try to infer error code from message
  let code = ErrorCodes.INTERNAL_ERROR;
  const msgLower = message.toLowerCase();

  if (msgLower.includes('not found')) {
    code = ErrorCodes.NOT_FOUND;
  } else if (msgLower.includes('access denied') || msgLower.includes('unauthorized')) {
    code = ErrorCodes.ACCESS_DENIED;
  } else if (msgLower.includes('invalid')) {
    code = ErrorCodes.INVALID_REQUEST;
  } else if (msgLower.includes('limit')) {
    code = ErrorCodes.USER_LIMIT_EXCEEDED;
  }

  return createError(code, message);
};

module.exports = {
  ErrorCodes,
  HttpStatusMap,
  createError,
  sendHttpError,
  createWsError,
  errorMiddleware,
  fromLegacyError
};
