/**
 * @file src/logger/error-fabs-logger.js
 * @description Фабрики ошибок подсистемы логирования
 * @version 0.2.0
 */
import { createError } from '@fab33/sys-errors'
import { LOGGER_ERROR_CODES } from './errors-logger.js'

/**
 * Зависимости модуля
 */
export const dependencies = {
  createError
}

/**
 * Устанавливает зависимости модуля
 * @param {Partial<typeof dependencies>} newDependencies - Новые зависимости
 */
export function setDependencies (newDependencies) {
  Object.assign(dependencies, newDependencies)
}

/**
 * Создает ошибку неверного уровня логирования
 *
 * @param {string} level - Некорректный уровень
 * @param {Error} [originalError] - Исходная ошибка
 */
export function createInvalidLogLevelError (level, originalError = null) {
  const { createError } = dependencies
  return createError(LOGGER_ERROR_CODES.INVALID_LOG_LEVEL, { level }, originalError)
}

/**
 * Создает ошибку создания директории логов
 *
 * @param {string} path - Путь к директории
 * @param {string} reason - Причина ошибки
 * @param {Error} [originalError] - Исходная ошибка
 */
export function createLogDirError (path, reason, originalError = null) {
  const { createError } = dependencies
  return createError(LOGGER_ERROR_CODES.LOG_DIR_CREATE_FAILED, {
    path,
    reason
  }, originalError)
}

/**
 * Создает ошибку записи в файл лога
 *
 * @param {string} path - Путь к файлу
 * @param {string} reason - Причина ошибки
 * @param {Error} [originalError] - Исходная ошибка
 */
export function createLogWriteError (path, reason, originalError = null) {
  const { createError } = dependencies
  return createError(LOGGER_ERROR_CODES.LOG_FILE_WRITE_FAILED, {
    path,
    reason
  }, originalError)
}

/**
 * Создает ошибку ротации лога
 *
 * @param {string} path - Путь к файлу
 * @param {string} reason - Причина ошибки
 * @param {Error} [originalError] - Исходная ошибка
 */
export function createRotateError (path, reason, originalError = null) {
  const { createError } = dependencies
  return createError(LOGGER_ERROR_CODES.ROTATE_FAILED, {
    path,
    reason
  }, originalError)
}

/**
 * Создает ошибку очистки архивов
 *
 * @param {string} reason - Причина ошибки
 * @param {Error} [originalError] - Исходная ошибка
 */
export function createCleanupError (reason, originalError = null) {
  const { createError } = dependencies
  return createError(LOGGER_ERROR_CODES.CLEANUP_FAILED, { reason }, originalError)
}

/**
 * Создает ошибку форматирования
 *
 * @param {string} reason - Причина ошибки
 * @param {Error} [originalError] - Исходная ошибка
 */
export function createFormatError (reason, originalError = null) {
  const { createError } = dependencies
  return createError(LOGGER_ERROR_CODES.FORMAT_FAILED, { reason }, originalError)
}

/**
 * Создает ошибку инициализации транспорта
 *
 * @param {string} reason - Причина ошибки
 * @param {Error} [originalError] - Исходная ошибка
 */
export function createTransportError (reason, originalError = null) {
  const { createError } = dependencies
  return createError(LOGGER_ERROR_CODES.TRANSPORT_INIT_FAILED, { reason }, originalError)
}