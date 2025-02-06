/**
 * @file src/logger/errors-logger.js
 * @description Определение ошибок подсистемы логирования
 * @version 0.2.0
 */

/**
 * Коды ошибок подсистемы логирования
 */
export const LOGGER_ERROR_CODES = {
  // Ошибки конфигурации
  CONFIG_LOAD_FAILED: {
    code: 'LOG_CONFIG_LOAD_FAILED',
    message: 'Failed to load logger configuration: {reason}',
    subsystem: 'logger',
    recoverable: true,
    docs: 'docs/errors/logger.md#config-load-failed'
  },

  INVALID_LOG_LEVEL: {
    code: 'LOG_INVALID_LEVEL',
    message: 'Invalid log level: {level}',
    subsystem: 'logger',
    recoverable: true,
    docs: 'docs/errors/logger.md#invalid-log-level'
  },

  // Ошибки файловой системы
  LOG_DIR_CREATE_FAILED: {
    code: 'LOG_DIR_CREATE_FAILED',
    message: 'Failed to create log directory {path}: {reason}',
    subsystem: 'logger',
    recoverable: false,
    docs: 'docs/errors/logger.md#dir-create-failed'
  },

  LOG_FILE_WRITE_FAILED: {
    code: 'LOG_FILE_WRITE_FAILED',
    message: 'Failed to write to log file {path}: {reason}',
    subsystem: 'logger',
    recoverable: true,
    docs: 'docs/errors/logger.md#file-write-failed'
  },

  // Ошибки ротации логов
  ROTATE_FAILED: {
    code: 'LOG_ROTATE_FAILED',
    message: 'Failed to rotate log file {path}: {reason}',
    subsystem: 'logger',
    recoverable: true,
    docs: 'docs/errors/logger.md#rotate-failed'
  },

  CLEANUP_FAILED: {
    code: 'LOG_CLEANUP_FAILED',
    message: 'Failed to cleanup old log archives: {reason}',
    subsystem: 'logger',
    recoverable: true,
    docs: 'docs/errors/logger.md#cleanup-failed'
  },

  // Ошибки форматирования
  FORMAT_FAILED: {
    code: 'LOG_FORMAT_FAILED',
    message: 'Failed to format log message: {reason}',
    subsystem: 'logger',
    recoverable: true,
    docs: 'docs/errors/logger.md#format-failed'
  },

  // Ошибки транспорта
  TRANSPORT_INIT_FAILED: {
    code: 'LOG_TRANSPORT_INIT_FAILED',
    message: 'Failed to initialize log transport: {reason}',
    subsystem: 'logger',
    recoverable: false,
    docs: 'docs/errors/logger.md#transport-init-failed'
  }
}

