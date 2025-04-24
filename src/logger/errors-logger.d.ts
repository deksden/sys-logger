/**
 * @file src/logger/errors-logger.d.ts
 * @description TypeScript декларации для кодов ошибок подсистемы логирования.
 * @version 0.2.0
 */

/**
 * @interface ErrorCodeDefinition
 * @description Определение структуры кода ошибки для единообразия.
 */
export interface ErrorCodeDefinition {
  /** @property {string} code - Уникальный код ошибки. */
  code: string;
  /** @property {string} message - Шаблон сообщения об ошибке. */
  message: string;
  /** @property {string} subsystem - Имя подсистемы, к которой относится ошибка. */
  subsystem: string;
  /** @property {boolean} recoverable - Указывает, можно ли восстановиться после этой ошибки. */
  recoverable: boolean;
  /** @property {string} [docs] - Опциональная ссылка на документацию по ошибке. */
  docs?: string;
}

/**
 * @const {object} LOGGER_ERROR_CODES
 * @description Объект, содержащий определения кодов ошибок для подсистемы логирования.
 */
export const LOGGER_ERROR_CODES: {
  /** @property {ErrorCodeDefinition} CONFIG_LOAD_FAILED - Ошибка загрузки конфигурации логгера. */
  CONFIG_LOAD_FAILED: ErrorCodeDefinition;
  /** @property {ErrorCodeDefinition} INVALID_LOG_LEVEL - Указан неверный уровень логирования. */
  INVALID_LOG_LEVEL: ErrorCodeDefinition;
  /** @property {ErrorCodeDefinition} LOG_DIR_CREATE_FAILED - Не удалось создать директорию для логов. */
  LOG_DIR_CREATE_FAILED: ErrorCodeDefinition;
  /** @property {ErrorCodeDefinition} LOG_FILE_WRITE_FAILED - Не удалось записать данные в лог-файл. */
  LOG_FILE_WRITE_FAILED: ErrorCodeDefinition;
  /** @property {ErrorCodeDefinition} ROTATE_FAILED - Ошибка при попытке ротации лог-файла. */
  ROTATE_FAILED: ErrorCodeDefinition;
  /** @property {ErrorCodeDefinition} CLEANUP_FAILED - Ошибка при удалении старых архивных лог-файлов. */
  CLEANUP_FAILED: ErrorCodeDefinition;
  /** @property {ErrorCodeDefinition} FORMAT_FAILED - Ошибка при форматировании лог-сообщения. */
  FORMAT_FAILED: ErrorCodeDefinition;
  /** @property {ErrorCodeDefinition} TRANSPORT_INIT_FAILED - Не удалось инициализировать транспорт(ы) логирования. */
  TRANSPORT_INIT_FAILED: ErrorCodeDefinition;
}
