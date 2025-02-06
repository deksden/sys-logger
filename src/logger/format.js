/**
 * @file src/logger/format.js
 * @description Модуль форматирования логов с поддержкой цветного вывода и различных форматов данных
 * @version 0.2.2
 */

import chalk from 'chalk'
import { createLogger } from './logger.js'
import { SystemError } from '@fab33/sys-errors'
import { createFormatError } from './error-fabs-logger.js'

const logger = createLogger('logger:format')

/**
 * Зависимости модуля для dependency injection
 */
export const dependencies = {
  chalk,
  JSON: JSON,
  logger
}

/**
 * Устанавливает зависимости модуля
 * @param {Partial<typeof dependencies>} newDependencies - Новые зависимости
 */
export function setDependencies (newDependencies) {
  Object.assign(dependencies, newDependencies)
}

/**
 * Форматирует объект для логирования с поддержкой цветов и различных типов данных
 *
 * Основная ответственность:
 * - Преобразование различных типов данных в строковое представление
 * - Форматирование объектов без отступов для компактности
 * - Корректная обработка специальных типов (Error, Date, RegExp и др.)
 * - Специальная обработка SystemError
 * - Применение цветового оформления при необходимости
 *
 * @param {any} obj - Объект для логирования
 * @param {Object} [options] - Опции форматирования
 * @param {boolean} [options.colors=true] - Использовать цвета
 * @param {boolean} [options.showHidden=false] - Показывать скрытые свойства
 * @returns {string} Отформатированная строка для вывода в лог
 */
export function formatForLog (obj, options = {}) {
  const { chalk, JSON, logger } = dependencies
  const {
    colors = true,
    showHidden = false
  } = options

  // Обработка примитивных значений
  if (obj === null || obj === undefined) {
    return String(obj)
  }

  if (typeof obj !== 'object') {
    return String(obj)
  }

  // Специальная обработка SystemError
  if (obj instanceof SystemError) {
    const parts = []
    if (obj.code) parts.push(obj.code)
    if (obj.name) parts.push(obj.name)
    const prefix = parts.join(' ')
    const errorInfo = `${prefix}: ${obj.message}`
    const result = [colors ? chalk.red(errorInfo) : errorInfo]

    if (obj.stack) {
      const stackLines = obj.stack.split('\n').slice(1)
      const formattedStack = stackLines.map(line =>
        colors ? chalk.gray(line) : line
      )
      result.push(formattedStack.join('\n'))
    }

    return result.join('\n')
  }

  // Обработка обычных ошибок - всегда используем name
  if (obj instanceof Error) {
    const errorInfo = `${obj.name}: ${obj.message}`
    const parts = [colors ? chalk.red(errorInfo) : errorInfo]

    if (obj.stack) {
      const stackLines = obj.stack.split('\n').slice(1)
      const formattedStack = stackLines.map(line =>
        colors ? chalk.gray(line) : line
      )
      parts.push(formattedStack.join('\n'))
    }

    return parts.join('\n')
  }

  // Специальная обработка RegExp
  if (obj instanceof RegExp) {
    return obj.toString()
  }

  // Форматирование даты
  if (obj instanceof Date) {
    return obj.toISOString()
  }

  try {
    // Преобразование объекта с обработкой специальных типов
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof SystemError) {
        return {
          name: value.name,
          message: value.message,
          code: value.code,
          stack: value.stack
        }
      }
      if (value instanceof Error) {
        return {
          name: value.name,
          code: value.code,
          message: value.message,
          stack: value.stack
        }
      }
      if (value instanceof RegExp) {
        return value.toString()
      }
      if (value instanceof Date) {
        return value.toISOString()
      }
      if (typeof value === 'bigint') {
        return value.toString()
      }
      if (value instanceof Map) {
        return Object.fromEntries(value)
      }
      if (value instanceof Set) {
        return Array.from(value)
      }
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return '[Binary Data]'
      }
      if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`
      }
      return value
    })
  } catch (error) {
    logger.error('Failed to format object for logging:', error)
    throw createFormatError('Failed to serialize object', error)
  }
}

/**
 * Форматирует метку времени в заданном формате с опциональным цветовым оформлением
 *
 * Основная ответственность:
 * - Преобразование даты в требуемый формат
 * - Добавление цветового оформления
 *
 * @param {Date} [date] - Дата для форматирования
 * @param {Object} [options] - Опции форматирования
 * @param {boolean} [options.colors=true] - Использовать цвета
 * @param {string} [options.format='ISO'] - Формат (ISO, UTC, local)
 * @returns {string} Отформатированная метка времени
 */
export function formatTimestamp (date = new Date(), options = {}) {
  const { chalk } = dependencies
  const {
    colors = true,
    format = 'ISO'
  } = options

  let timeStr
  switch (format) {
    case 'UTC':
      timeStr = date.toUTCString()
      break
    case 'local':
      timeStr = date.toLocaleString()
      break
    default:
      timeStr = date.toISOString()
  }

  return colors ? chalk.gray(timeStr) : timeStr
}

/**
 * Форматирует сообщение об ошибке с опциональным включением стека вызовов
 *
 * Основная ответственность:
 * - Форматирование основной информации об ошибке
 * - Специальная обработка SystemError
 * - Включение стека вызовов при необходимости
 * - Применение цветового оформления
 *
 * @param {Error} error - Объект ошибки
 * @param {Object} [options] - Опции форматирования
 * @param {boolean} [options.colors=true] - Использовать цвета
 * @param {boolean} [options.stack=true] - Включать стек вызовов
 * @returns {string} Отформатированное сообщение об ошибке
 */
export function formatError (error, options = {}) {
  const { chalk } = dependencies
  const {
    colors = true,
    stack = true
  } = options

  const parts = []

  // Специальная обработка для SystemError
  if (error instanceof SystemError) {
    const prefix = [error.code, error.name].filter(Boolean).join(' ')
    const errorInfo = `${prefix}: ${error.message}`
    parts.push(colors ? chalk.red(errorInfo) : errorInfo)
  } else {
    // Для обычных ошибок всегда используем name
    const errorInfo = `${error.name}: ${error.message}`
    parts.push(colors ? chalk.red(errorInfo) : errorInfo)
  }

  if (stack && error.stack) {
    const stackLines = error.stack.split('\n').slice(1)
    const formattedStack = stackLines.map(line =>
      colors ? chalk.gray(line) : line
    )
    parts.push(formattedStack.join('\n'))
  }

  return parts.join('\n')
}
