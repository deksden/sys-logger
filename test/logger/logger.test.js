/**
 * @file test/logger/logger.test.js
 * @description Тесты основного модуля логирования
 * @version 0.5.4
 * @tested-file src/logger/logger.js
 * @tested-file-version 0.5.5
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.3.0.md
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import { dependencies as loggerDeps, setDependencies, createLogger } from '../../src/logger/logger.js'
import { SystemError } from '@fab33/sys-errors'
import { LOGGER_ERROR_CODES } from '../../src/logger/errors-logger.js'

// Используем реальный логгер для отладки тестов
const logger = createLogger('test:logger')

describe('(logger.js) Модуль основного логирования', () => {
  // Сохраняем оригинальные зависимости
  const origDeps = { ...loggerDeps }

  // Общие моки для всех тестов
  let mockPino
  let mockTransport
  let mockPinoLogger

  beforeEach(() => {
    logger.trace('Инициализация тестов logger.js')

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

    // Мок для pino
    mockPino = vi.fn().mockReturnValue(mockPinoLogger)
    mockPino.transport = vi.fn().mockReturnValue({})

    // Мок для createTransport
    mockTransport = vi.fn().mockReturnValue({
      transport: { targets: [] },
      level: 'trace'
    })

    // Устанавливаем моки
    setDependencies({
      env: { DEBUG: '*', LOG_LEVEL: 'trace' },
      pino: mockPino,
      createTransport: mockTransport,
      baseLogger: mockPinoLogger // Устанавливаем мок логгера
    })

    logger.debug('Моки установлены')
  })

  afterEach(() => {
    logger.trace('Восстановление оригинальных зависимостей')
    setDependencies(origDeps)
    vi.clearAllMocks()
  })

  describe('createLogger() - Создание логгера', () => {
    test('создание логгера без namespace', () => {
      logger.trace('Тест: создание логгера без namespace')

      const testLogger = createLogger()

      // При установленном baseLogger не вызывается createTransport
      expect(mockTransport).not.toHaveBeenCalled()
      expect(mockPino).not.toHaveBeenCalled()
      expect(mockPinoLogger.child).not.toHaveBeenCalled()

      // Проверяем доступность всех уровней
      const testData = { test: true }

      testLogger.trace(testData)
      testLogger.debug(testData)
      testLogger.info(testData)
      testLogger.warn(testData)
      testLogger.error(testData)
      testLogger.fatal(testData)

      expect(mockPinoLogger.trace).toHaveBeenCalledWith(testData)
      expect(mockPinoLogger.debug).toHaveBeenCalledWith(testData)
      expect(mockPinoLogger.info).toHaveBeenCalledWith(testData)
      expect(mockPinoLogger.warn).toHaveBeenCalledWith(testData)
      expect(mockPinoLogger.error).toHaveBeenCalledWith(testData)
      expect(mockPinoLogger.fatal).toHaveBeenCalledWith(testData)
    })

    test('поддержка различных вариантов вызова методов', () => {
      logger.trace('Тест: различные варианты вызова')

      const testLogger = createLogger()
      const testObj = { field: 'value' }
      const testMsg = 'test message'
      const testError = new Error('test error')

      // object
      testLogger.info(testObj)
      expect(mockPinoLogger.info).toHaveBeenCalledWith(testObj)

      // message
      testLogger.info(testMsg)
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, testMsg)

      // object + message
      testLogger.info(testObj, testMsg)
      expect(mockPinoLogger.info).toHaveBeenCalledWith(testObj, testMsg)

      // message + values
      testLogger.info(testMsg, 'value1', 'value2')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, testMsg, 'value1', 'value2')

      // error
      testLogger.error(testError)
      expect(mockPinoLogger.error).toHaveBeenCalledWith({ err: testError })
    })

    test('создание логгера с namespace', () => {
      logger.trace('Тест: создание логгера с namespace')

      const namespace = 'test:module'
      const testLogger = createLogger(namespace)

      expect(mockPinoLogger.child).toHaveBeenCalledWith({ namespace })

      const testMsg = 'test message'
      testLogger.info(testMsg)
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, testMsg)
    })

    test('фильтрация по DEBUG', () => {
      logger.trace('Тест: фильтрация по DEBUG')

      // Сохраняем и восстанавливаем моки окружения для разных случаев
      const origEnv = { ...loggerDeps.env }

      // Тест 1: Пустой DEBUG блокирует все логи
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '' },
        baseLogger: mockPinoLogger
      })

      let testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).not.toHaveBeenCalled()

      // Тест 2: DEBUG=* разрешает все логи
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '*' },
        baseLogger: mockPinoLogger
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, 'test')

      // Тест 3: Разрешающий паттерн
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: 'app:*' },
        baseLogger: mockPinoLogger
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, 'test')

      // Тест 4: Запрещающий паттерн
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '*,-app:test' },
        baseLogger: mockPinoLogger
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).not.toHaveBeenCalled()

      // Тест 5: Пробелы в DEBUG обрабатываются корректно
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '  app:*  ' },
        baseLogger: mockPinoLogger
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, 'test')

      // Восстанавливаем окружение
      setDependencies({
        ...loggerDeps,
        env: origEnv
      })
    })

    test('создание логгера при отсутствии baseLogger', () => {
      logger.trace('Тест: создание без baseLogger')

      // Убираем baseLogger
      setDependencies({
        ...loggerDeps,
        baseLogger: null
      })

      const testLogger = createLogger()
      expect(mockTransport).toHaveBeenCalled()
      expect(mockPino).toHaveBeenCalled()

      testLogger.info('test')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, 'test')
    })

    test('ошибка при инициализации транспорта', () => {
      logger.trace('Тест: ошибка инициализации')

      // Убираем baseLogger и вызываем ошибку в транспорте
      setDependencies({
        ...loggerDeps,
        baseLogger: null,
        createTransport: vi.fn().mockImplementation(() => {
          throw new Error('Transport failed')
        })
      })

      expect(() => createLogger()).toThrow(SystemError)

      try {
        createLogger()
      } catch (error) {
        expect(error.code).toBe(LOGGER_ERROR_CODES.TRANSPORT_INIT_FAILED.code)
        expect(error.message).toContain('Failed to create logger')
      }
    })
  })
})
