/**
 * @file src/logger/error-fabs-logger.d.ts
 * @description TypeScript декларации для фабрик ошибок подсистемы логирования.
 * @version 0.2.0
 */

// Импортируем тип SystemError, если он доступен
type SystemError = any; // Или: import { SystemError } from '@fab33/sys-errors';

/**
 * Создает ошибку неверного уровня логирования.
 * Используется, когда в конфигурации или при вызове указан нераспознанный уровень.
 * @param {string} level - Некорректное строковое значение уровня, которое вызвало ошибку.
 * @param {Error | null} [originalError] - Исходная ошибка, если она была (например, при парсинге).
 * @returns {SystemError} Экземпляр системной ошибки с кодом INVALID_LOG_LEVEL.
 */
export function createInvalidLogLevelError (level: string, originalError?: Error | null): SystemError;

/**
 * Создает ошибку, связанную с невозможностью создать директорию для логов.
 * Обычно возникает из-за проблем с правами доступа или неверного пути.
 * @param {string} path - Путь к директории, которую не удалось создать.
 * @param {string} reason - Строковое описание причины ошибки (часто из оригинальной ошибки fs).
 * @param {Error | null} [originalError] - Исходная ошибка файловой системы (fs).
 * @returns {SystemError} Экземпляр системной ошибки с кодом LOG_DIR_CREATE_FAILED.
 */
export function createLogDirError (path: string, reason: string, originalError?: Error | null): SystemError;

/**
 * Создает ошибку, указывающую на невозможность записи в лог-файл.
 * Может быть вызвана проблемами с правами доступа, местом на диске или ошибками потока.
 * @param {string} path - Путь к лог-файлу, в который не удалось записать.
 * @param {string} reason - Строковое описание причины ошибки.
 * @param {Error | null} [originalError] - Исходная ошибка файловой системы или потока.
 * @returns {SystemError} Экземпляр системной ошибки с кодом LOG_FILE_WRITE_FAILED.
 */
export function createLogWriteError (path: string, reason: string, originalError?: Error | null): SystemError;

/**
 * Создает ошибку, возникшую во время процесса ротации лог-файла.
 * Это может включать ошибки переименования, создания нового файла или доступа к файлам.
 * @param {string} path - Путь к лог-файлу, который пытались ротировать.
 * @param {string} reason - Строковое описание причины ошибки.
 * @param {Error | null} [originalError] - Исходная ошибка файловой системы.
 * @returns {SystemError} Экземпляр системной ошибки с кодом ROTATE_FAILED.
 */
export function createRotateError (path: string, reason: string, originalError?: Error | null): SystemError;

/**
 * Создает ошибку, возникшую при попытке очистки (удаления) старых архивных лог-файлов.
 * @param {string} reason - Строковое описание причины ошибки (например, 'readdir failed', 'unlink failed').
 * @param {Error | null} [originalError] - Исходная ошибка файловой системы.
 * @returns {SystemError} Экземпляр системной ошибки с кодом CLEANUP_FAILED.
 */
export function createCleanupError (reason: string, originalError?: Error | null): SystemError;

/**
 * Создает ошибку, связанную с форматированием лог-сообщения перед записью.
 * Редко используется, но может возникнуть при кастомных форматерах или ошибках сериализации.
 * @param {string} reason - Строковое описание причины ошибки форматирования.
 * @param {Error | null} [originalError] - Исходная ошибка, если она привела к проблеме форматирования.
 * @returns {SystemError} Экземпляр системной ошибки с кодом FORMAT_FAILED.
 */
export function createFormatError (reason: string, originalError?: Error | null): SystemError;

/**
 * Создает ошибку, указывающую на сбой при инициализации или создании транспорта логирования.
 * Например, при ошибке в `pino.transport()` или при настройке `pino.destination()`.
 * @param {string} reason - Строковое описание причины сбоя инициализации.
 * @param {Error | null} [originalError] - Исходная ошибка, вызвавшая сбой (может быть ошибкой создания директории, если она произошла внутри).
 * @returns {SystemError} Экземпляр системной ошибки с кодом LOG_TRANSPORT_INIT_FAILED.
 */
export function createTransportError (reason: string, originalError?: Error | null): SystemError;
