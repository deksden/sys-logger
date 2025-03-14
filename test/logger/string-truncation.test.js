/**
 * @file test/logger/string-truncation.test.js
 * @description Тесты функциональности ограничения длины строк в логгере
 * @version 0.1.0
 * @tested-file src/logger/logger.js
 * @tested-file-version 0.7.0
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import { dependencies as loggerDeps, setDependencies, createLogger } from '../../src/logger/logger.js'
import { createLogger as realCreateLogger } from '../../src/logger/logger.js'

// Используем реальный логгер для отладки тестов
const logger = realCreateLogger('test:logger:string-truncation')

describe('(logger.js) Ограничение длины строк в логгере', () => {
  // Сохраняем оригинальные зависимости
  const origDeps = { ...loggerDeps }

  // Общие моки для всех тестов
  let mockPinoLogger
  let envBackup

  beforeEach(() => {
    logger.trace('Инициализация тестов ограничения длины строк')

    // Устанавливаем фиксированное время для тестов
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
    // Добавляем мок для Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => new Date().getTime())

    // Сохраняем оригинальные ENV переменные, если они есть
    envBackup = { ...process.env }

    // Настройка мока логгера pino
    mockPinoLogger = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis()
    }

    // Устанавливаем моки
    setDependencies({
      env: {
        DEBUG: '*',
        LOG_LEVEL: 'trace',
        LOG_MAX_STRING_LENGTH: '100',
        LOG_TRUNCATION_MARKER: '...'
      },
      pino: vi.fn(),
      baseLogger: mockPinoLogger,
      Date // Не забываем включить Date для тестов с датами
    })

    logger.debug('Моки установлены')
  })

  afterEach(() => {
    logger.trace('Восстановление оригинальных зависимостей')
    setDependencies(origDeps)
    // Восстанавливаем оригинальные ENV переменные
    process.env = { ...envBackup }
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  test('должен обрезать строки, превышающие установленный лимит', () => {
    logger.trace('Тест: обрезка строк, превышающих лимит')

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Длинная строка, которая должна быть обрезана
    const longString = 'A'.repeat(150)

    // Вызываем метод логгера с длинной строкой
    testLogger.info({ longValue: longString }, 'Test message')

    // Проверяем, что строка была обрезана до 100 символов + маркер
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      {
        longValue: 'A'.repeat(100) + '...'
      },
      'Test message'
    )

    logger.debug('Строка успешно обрезана')
  })

  test('не должен обрезать строки, не превышающие лимит', () => {
    logger.trace('Тест: сохранение строк в пределах лимита')

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Строка в пределах лимита
    const shortString = 'A'.repeat(50)

    // Вызываем метод логгера с короткой строкой
    testLogger.info({ shortValue: shortString }, 'Test message')

    // Проверяем, что строка сохранена без изменений
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      {
        shortValue: shortString
      },
      'Test message'
    )

    logger.debug('Короткая строка сохранена без изменений')
  })

  test('должен корректно обрабатывать вложенные объекты со строками', () => {
    logger.trace('Тест: обработка вложенных объектов со строками')

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Вложенный объект с длинными строками
    const complexObject = {
      level1: {
        normalString: 'Normal',
        longString: 'B'.repeat(120),
        level2: {
          anotherLongString: 'C'.repeat(150)
        }
      }
    }

    // Вызываем метод логгера с вложенным объектом
    testLogger.info({ data: complexObject }, 'Complex object')

    // Проверяем корректность обработки вложенных строк
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      {
        data: {
          level1: {
            normalString: 'Normal',
            longString: 'B'.repeat(100) + '...',
            level2: {
              anotherLongString: 'C'.repeat(100) + '...'
            }
          }
        }
      },
      'Complex object'
    )

    logger.debug('Вложенные объекты обработаны корректно')
  })

  test('должен использовать настраиваемый маркер обрезки', () => {
    logger.trace('Тест: настраиваемый маркер обрезки')

    // Устанавливаем кастомный маркер обрезки
    setDependencies({
      env: {
        DEBUG: '*',
        LOG_LEVEL: 'trace',
        LOG_MAX_STRING_LENGTH: '50',
        LOG_TRUNCATION_MARKER: '[обрезано]'
      },
      baseLogger: mockPinoLogger,
      Date
    })

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Длинная строка
    const longString = 'X'.repeat(100)

    // Вызываем метод логгера
    testLogger.info({ value: longString })

    // Проверяем использование кастомного маркера
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      {
        value: 'X'.repeat(50) + '[обрезано]'
      }
    )

    logger.debug('Кастомный маркер использован корректно')
  })

  test('не должен применять ограничение, если LOG_MAX_STRING_LENGTH=0', () => {
    logger.trace('Тест: отключение ограничения при LOG_MAX_STRING_LENGTH=0')

    // Устанавливаем LOG_MAX_STRING_LENGTH=0
    setDependencies({
      env: {
        DEBUG: '*',
        LOG_LEVEL: 'trace',
        LOG_MAX_STRING_LENGTH: '0',
        LOG_TRUNCATION_MARKER: '...'
      },
      baseLogger: mockPinoLogger,
      Date
    })

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Длинная строка
    const longString = 'Y'.repeat(200)

    // Вызываем метод логгера
    testLogger.info({ value: longString })

    // Проверяем, что строка сохранена без изменений
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      {
        value: longString
      }
    )

    logger.debug('Ограничение отключено при LOG_MAX_STRING_LENGTH=0')
  })

  test('должен обрезать длинные сообщения при прямом вызове', () => {
    logger.trace('Тест: обрезка длинных сообщений при прямом вызове')

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Длинное сообщение
    const longMessage = 'Z'.repeat(150)

    // Вызываем метод логгера с длинным сообщением
    testLogger.info(longMessage)

    // Проверяем, что сообщение было обрезано
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      undefined,
      'Z'.repeat(100) + '...'
    )

    logger.debug('Прямые сообщения обрезаны корректно')
  })

  test('не должен обрезать сообщения об ошибках', () => {
    logger.trace('Тест: сохранение полных сообщений об ошибках')

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Создаем ошибку с длинным сообщением
    const longErrorMessage = 'Error: ' + 'E'.repeat(200)
    const testError = new Error(longErrorMessage)

    // Вызываем метод логгера с ошибкой
    testLogger.error({ err: testError }, 'Error occurred')

    // Проверяем, что сообщение ошибки сохранено полностью
    expect(mockPinoLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          message: longErrorMessage,
          // Другие поля также должны присутствовать
          stack: expect.any(String),
          type: 'Error'
        })
      }),
      'Error occurred'
    )

    logger.debug('Сообщения об ошибках сохранены полностью')
  })

  test('должен корректно обрабатывать плейсхолдеры с длинными значениями', () => {
    logger.trace('Тест: обработка плейсхолдеров с длинными значениями')

    // Создаем тестовый логгер
    const testLogger = createLogger()

    // Длинное значение для подстановки в плейсхолдер
    const longValue = 'V'.repeat(150)

    // Вызываем метод логгера с плейсхолдером
    testLogger.info('Placeholder value: %s', longValue)

    // Проверяем, что значение для плейсхолдера было обрезано
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      undefined,
      'Placeholder value: %s',
      'V'.repeat(100) + '...'
    )

    logger.debug('Плейсхолдеры обработаны корректно')
  })
})
