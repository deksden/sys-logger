/**
 * @file test/logger/config.test.js
 * @version 0.2.2
 * @tested-file src/logger/config.js
 * @tested-file-version 0.5.3
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.1.0.md
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import { createLogger } from '../../src/logger/logger.js'
import { loadConfig, createTransport, setDependencies } from '../../src/logger/config.js'
import { SystemError } from '@fab33/sys-errors'
import { LOGGER_ERROR_CODES } from '../../src/logger/errors-logger.js'

describe('(config.js) Модуль конфигурации логгера', () => {
  let mockDeps
  let mockLogger
  let prettyOptions

  beforeEach(() => {
    mockLogger = createLogger('test:logger:config')

    // Создаем базовые моки для стримов
    const mockStream = {
      write: vi.fn(),
      end: vi.fn()
    }

    // Создаем мок для pretty
    prettyOptions = null
    const mockPretty = vi.fn((options) => {
      prettyOptions = options
      return mockStream
    })

    // Создаем моки для основных зависимостей
    mockDeps = {
      fs: {
        readFileSync: vi.fn(),
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn()
      },
      path: {
        join: vi.fn((...args) => args.join('/')),
        dirname: vi.fn()
      },
      pino: {
        destination: vi.fn(() => mockStream),
        multistream: vi.fn((streams) => ({
          streams,
          write: mockStream.write,
          end: mockStream.end
        }))
      },
      pretty: mockPretty,
      env: {
        LOG_LEVEL: 'info',
        LOG_FOLDER: 'test-logs',
        LOG_FILE_OUTPUT: 'true', // Явно включаем файловый вывод
        LOG_CONSOLE_OUTPUT: 'true'
      }
    }

    // Устанавливаем моки через dependency injection
    setDependencies(mockDeps)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loadConfig() - Загрузка конфигурации', () => {
    test('должен загрузить конфигурацию с дефолтными значениями', () => {
      mockLogger.trace('Тестирование загрузки конфигурации с дефолтами')

      // Действие
      const config = loadConfig(mockDeps.env)

      // Проверки
      expect(config).toMatchObject({
        logLevel: 'info',
        colorize: true,
        fileOutput: true,
        consoleOutput: true,
        logFolder: 'test-logs',
        sync: false,
        pretty: false
      })

      mockLogger.debug({ config }, 'Конфигурация загружена с дефолтными значениями')
    }, 2000)

    test('должен корректно использовать настройки из окружения', () => {
      mockLogger.trace('Тестирование загрузки конфигурации из окружения')

      // Подготовка
      mockDeps.env = {
        LOG_LEVEL: 'debug',
        LOG_COLORIZE: 'false',
        LOG_FILE_OUTPUT: 'false',
        LOG_CONSOLE_OUTPUT: 'false',
        LOG_FOLDER: '/custom/logs',
        LOG_SYNC: 'true',
        LOG_PRETTY: 'true'
      }

      // Действие
      const config = loadConfig(mockDeps.env)

      // Проверки
      expect(config).toMatchObject({
        logLevel: 'debug',
        colorize: false,
        fileOutput: false,
        consoleOutput: false,
        logFolder: '/custom/logs',
        sync: true,
        pretty: true
      })

      mockLogger.debug({ config }, 'Конфигурация загружена из окружения')
    }, 2000)
  })

  describe('createTransport() - Создание транспортов', () => {
    test('должен создать мультиплексный транспорт с консолью и файлом', () => {
      mockLogger.trace('Тестирование создания мультиплексного транспорта')

      // Подготовка - пакетный файл для тестов
      mockDeps.fs.readFileSync.mockReturnValue('{"name": "test-app"}')

      // Действие
      const result = createTransport(mockDeps.env)

      // Проверки
      expect(result).toEqual({
        level: 30, // info
        transport: expect.any(Object)
      })

      expect(mockDeps.pino.multistream).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          level: 30,
          stream: expect.any(Object)
        })
      ]))

      expect(prettyOptions).toMatchObject({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        sync: true
      })

      mockLogger.debug('Мультиплексный транспорт создан успешно')
    }, 2000)

    test('должен создать только консольный транспорт если отключен файловый', () => {
      mockLogger.trace('Тестирование создания только консольного транспорта')

      // Подготовка
      mockDeps.env.LOG_FILE_OUTPUT = 'false'
      mockDeps.fs.readFileSync.mockReturnValue('{"name": "test-app"}')

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      const multistream = mockDeps.pino.multistream.mock.calls[0][0]
      expect(multistream).toHaveLength(1)
      expect(prettyOptions).toBeTruthy()

      mockLogger.debug({
        streamsCount: multistream.length,
        prettyOptions
      }, 'Создан только консольный транспорт')
    }, 2000)

    test('должен создать транспорт по умолчанию если отключены все', () => {
      mockLogger.trace('Тестирование создания дефолтного транспорта')

      // Подготовка
      mockDeps.env.LOG_FILE_OUTPUT = 'false'
      mockDeps.env.LOG_CONSOLE_OUTPUT = 'false'
      mockDeps.fs.readFileSync.mockReturnValue('{"name": "test-app"}')

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      const multistream = mockDeps.pino.multistream.mock.calls[0][0]
      expect(multistream).toHaveLength(1)
      expect(prettyOptions).toBeTruthy()

      mockLogger.debug({
        streamsCount: multistream.length,
        defaultTransport: true
      }, 'Создан транспорт по умолчанию')
    }, 2000)

    test('должен обработать ошибку создания директории логов', () => {
      mockLogger.trace('Тестирование ошибки создания директории')

      // Подготовка
      const error = new Error('Permission denied')
      mockDeps.fs.mkdirSync.mockImplementation(() => {
        throw error
      })
      mockDeps.fs.existsSync.mockReturnValue(false) // Директория не существует
      mockDeps.fs.readFileSync.mockReturnValue('{"name": "test-app"}')
      mockDeps.env.LOG_FILE_OUTPUT = 'true' // Явно включаем файловый вывод

      try {
        // Действие
        createTransport(mockDeps.env)
        // Если не выбросило ошибку - тест должен упасть
        // 'Ожидалась ошибка при создании директории логов'
        expect(true).toBe(false)
      } catch (err) {
        // Проверки
        expect(err).toBeInstanceOf(SystemError)
        expect(err.code).toBe(LOGGER_ERROR_CODES.TRANSPORT_INIT_FAILED.code)

        // Проверяем оригинальную ошибку
        expect(err.original).toBeInstanceOf(SystemError)
        expect(err.original.code).toBe(LOGGER_ERROR_CODES.LOG_DIR_CREATE_FAILED.code)
        expect(err.original.context).toMatchObject({
          path: 'test-logs',
          reason: 'Permission denied'
        })
      }

      mockLogger.debug('Ошибка создания директории обработана')
    }, 2000)
  })
})
