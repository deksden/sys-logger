/**
 * @file test/logger/format.test.js
 * @description Тесты модуля форматирования логов
 * @version 0.5.3
 * @tested-file src/logger/format.js
 * @tested-file-version 0.2.2
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.3.0.md
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import {
  dependencies as formatDeps,
  setDependencies,
  formatForLog,
  formatError,
  formatTimestamp
} from '../../src/logger/format.js'
import { SystemError } from '@fab33/sys-errors'
import { LOGGER_ERROR_CODES } from '../../src/logger/errors-logger.js'
import { createLogger } from '../../src/logger/logger.js'

// Используем реальный логгер для отладки тестов
const logger = createLogger('test:logger:format')

describe('(format.js) Модуль форматирования', () => {
  // Сохраняем оригинальные зависимости
  const origDeps = { ...formatDeps }

  // Минимальный мок для chalk
  const mockChalk = {
    red: (str) => str,
    gray: (str) => str
  }

  beforeEach(() => {
    logger.trace('Инициализация тестов format.js')

    // Устанавливаем моки только для необходимых зависимостей
    setDependencies({
      chalk: mockChalk,
      JSON, // Используем реальный JSON
      logger // Используем реальный логгер
    })

    logger.debug('Моки установлены')
  })

  afterEach(() => {
    logger.trace('Восстановление оригинальных зависимостей')
    setDependencies(origDeps)
    vi.clearAllMocks()
  })

  describe('formatForLog() - Форматирование для логирования', () => {
    test('форматирование основных типов данных', () => {
      logger.trace('Тест: форматирование базовых типов')

      // Проверяем базовое поведение с разными типами
      expect(formatForLog('test')).toBe('test')
      expect(formatForLog(123)).toBe('123')
      expect(formatForLog(true)).toBe('true')
      expect(formatForLog(null)).toBe('null')
      expect(formatForLog(undefined)).toBe('undefined')

      const obj = { a: 1, b: 'test' }
      expect(formatForLog(obj)).toBe(JSON.stringify(obj))
    })

    test('форматирование обычных ошибок всегда использует name', () => {
      logger.trace('Тест: форматирование обычных ошибок')

      // Создаем новый Error для каждого теста
      const error = new Error('Test error')
      const formatted = formatForLog(error)

      // Проверяем что используется name
      expect(formatted).toContain('Error: Test error')
      expect(formatted).toContain(error.stack)

      // Даже при наличии code все равно используется name
      const errorWithCode = new Error('Test error')
      errorWithCode.code = 'ERR_TEST'
      const formattedWithCode = formatForLog(errorWithCode)
      expect(formattedWithCode).toContain('Error: Test error')
      expect(formattedWithCode).toContain(errorWithCode.stack)
    })

    test('форматирование системных ошибок включает и code и name', () => {
      logger.trace('Тест: форматирование SystemError')

      const sysError = new SystemError({
        code: 'TEST_ERROR',
        message: 'Test error'
      })

      const formatted = formatForLog(sysError)

      expect(formatted).toContain('TEST_ERROR')
      expect(formatted).toContain('SystemError')
      expect(formatted).toContain('Test error')
      expect(formatted).toContain(sysError.stack)
    })

    test('форматирование специальных объектов', () => {
      logger.trace('Тест: форматирование специальных объектов')

      // RegExp преобразуется в строку напрямую
      const regexp = /test/g
      expect(formatForLog(regexp)).toBe('/test/g')

      // Даты форматируются в ISO формат
      const date = new Date('2024-01-01T12:00:00Z')
      expect(formatForLog(date)).toBe('2024-01-01T12:00:00.000Z')

      // Map преобразуется в объект
      const map = new Map([['a', 1], ['b', 2]])
      expect(formatForLog(map)).toBe('{"a":1,"b":2}')

      // Set преобразуется в массив
      const set = new Set([1, 2, 3])
      expect(formatForLog(set)).toBe('[1,2,3]')
    })

    test('ошибка при некорректных данных', () => {
      logger.trace('Тест: обработка некорректных данных')

      // Создаем объект с циклической ссылкой
      const obj = { a: 1 }
      obj.self = obj

      expect(() => formatForLog(obj)).toThrow(SystemError)

      try {
        formatForLog(obj)
      } catch (error) {
        expect(error.code).toBe(LOGGER_ERROR_CODES.FORMAT_FAILED.code)
        expect(error.message).toContain('Failed to serialize object')
      }
    })
  })

  describe('formatError() - Форматирование ошибок', () => {
    test('форматирование системной ошибки', () => {
      logger.trace('Тест: форматирование SystemError')

      const sysError = new SystemError({
        code: 'TEST_ERROR',
        message: 'Test error'
      })

      const formatted = formatError(sysError)

      expect(formatted).toContain('TEST_ERROR')
      expect(formatted).toContain('SystemError')
      expect(formatted).toContain('Test error')
      expect(formatted).toContain(sysError.stack)
    })

    test('форматирование обычной ошибки всегда использует name', () => {
      logger.trace('Тест: форматирование стандартной Error')

      const error = new Error('Test error')
      let formatted = formatError(error)

      // Всегда используем name
      expect(formatted).toContain('Error: Test error')
      expect(formatted).toContain(error.stack)

      // Даже при наличии code используем name
      error.code = 'ERR_TEST'
      formatted = formatError(error)
      expect(formatted).toContain('Error: Test error')
    })

    test('форматирование без стека', () => {
      logger.trace('Тест: форматирование без стека')

      const error = new Error('Test error')
      const formatted = formatError(error, { stack: false })

      expect(formatted).toContain('Error: Test error')
      expect(formatted).not.toContain('at')
    })
  })

  describe('formatTimestamp() - Форматирование меток времени', () => {
    test('форматирование в разных форматах', () => {
      logger.trace('Тест: форматирование timestamp')

      const date = new Date('2024-01-01T12:00:00Z')

      expect(formatTimestamp(date, { format: 'ISO' }))
        .toBe('2024-01-01T12:00:00.000Z')

      expect(formatTimestamp(date, { format: 'UTC' }))
        .toContain('Mon, 01 Jan 2024')

      const local = formatTimestamp(date, { format: 'local' })
      expect(local).toBeTruthy()
      expect(typeof local).toBe('string')
    })
  })
})
