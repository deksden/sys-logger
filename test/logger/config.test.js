/**
 * @file test/logger/config.test.js
 * @version 0.3.1
 * @tested-file src/logger/config.js
 * @tested-file-version 0.6.1
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.1.0.md
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import { createLogger } from '../../src/logger/logger.js'
import {
  loadConfig,
  createTransport,
  setDependencies,
  processFilenameTemplate
} from '../../src/logger/config.js'
import { SystemError } from '@fab33/sys-errors'
import { LOGGER_ERROR_CODES } from '../../src/logger/errors-logger.js'

describe('(config.js) Модуль конфигурации логгера', () => {
  let mockDeps
  let mockLogger
  let prettyOptions

  beforeEach(() => {
    mockLogger = createLogger('test:logger:config')

    // Устанавливаем фиксированное время для тестов
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
    // Добавляем мок для Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => new Date().getTime())

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
        })),
        transport: vi.fn().mockReturnValue({
          // Мок для pino.transport
        })
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
    vi.useRealTimers()
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
        pretty: false,
        transportConfigs: [] // Новое поле для конфигураций транспортов
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
        pretty: true,
        transportConfigs: []
      })

      mockLogger.debug({ config }, 'Конфигурация загружена из окружения')
    }, 2000)

    test('должен обрабатывать настройки множественных транспортов', () => {
      mockLogger.trace('Тестирование настроек множественных транспортов')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'console',
        TRANSPORT1_LEVEL: 'debug',
        TRANSPORT1_COLORS: 'true',
        TRANSPORT2: 'file',
        TRANSPORT2_LEVEL: 'error',
        TRANSPORT2_FOLDER: '/custom/logs',
        TRANSPORT2_FILENAME: '{app_name}_{date}.log'
      }

      // Действие
      const config = loadConfig(mockDeps.env)

      // Проверки
      expect(config.transportConfigs).toHaveLength(2)

      // Проверка консольного транспорта
      expect(config.transportConfigs[0]).toMatchObject({
        type: 'console',
        level: 'debug',
        colors: true,
        enabled: true
      })

      // Проверка файлового транспорта
      expect(config.transportConfigs[1]).toMatchObject({
        type: 'file',
        level: 'error',
        folder: '/custom/logs',
        filename: '{app_name}_{date}.log',
        enabled: true
      })

      mockLogger.debug({ config }, 'Настройки множественных транспортов загружены')
    }, 2000)
  })

  describe('processFilenameTemplate() - Обработка шаблонов', () => {
    test('должен корректно обрабатывать шаблоны в имени файла', () => {
      mockLogger.trace('Тестирование обработки шаблонов')

      // Мокаем время для предсказуемого результата - уже установлено в beforeEach

      // Мокаем метод для загрузки информации о приложении
      mockDeps.fs.readFileSync.mockReturnValue('{"name": "test-app", "version": "1.2.3"}')

      // Проверяем разные шаблоны
      const templates = {
        '{app_name}.log': 'test-app.log',
        '{app_name}_{date}.log': 'test-app_2024-01-01.log',
        'logs/{datetime}/{app_name}.log': 'logs/2024-01-01_12-00-00/test-app.log',
        '{app_name}_v{app_version}_{date}.log': 'test-app_v1.2.3_2024-01-01.log'
      }

      for (const [template, expected] of Object.entries(templates)) {
        const result = processFilenameTemplate(template)
        expect(result).toBe(expected)
      }

      // Проверяем значение по умолчанию
      expect(processFilenameTemplate()).toBe('app.log')
      expect(processFilenameTemplate('')).toBe('app.log')

      mockLogger.debug('Шаблоны в именах файлов обработаны корректно')
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

    test('должен использовать pino.transport для новых настроек транспортов', () => {
      mockLogger.trace('Тестирование создания транспортов через pino.transport')

      // Подготовка - настраиваем множественные транспорты
      mockDeps.env = {
        TRANSPORT1: 'console',
        TRANSPORT1_LEVEL: 'debug',
        TRANSPORT1_COLORS: 'true',
        TRANSPORT2: 'file',
        TRANSPORT2_LEVEL: 'error',
        TRANSPORT2_FOLDER: '/custom/logs',
        TRANSPORT2_FILENAME: '{app_name}.log'
      }

      // Мокаем результат pino.transport
      const mockTransport = { /* мок транспорта */ }
      mockDeps.pino.transport.mockReturnValue(mockTransport)

      // Действие
      const result = createTransport(mockDeps.env)

      // Проверки
      expect(result).toEqual({
        level: 20, // debug (минимальный из заданных уровней)
        transport: mockTransport
      })

      // Проверяем вызов pino.transport с правильными параметрами
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'debug',
            target: 'pino-pretty',
            options: expect.objectContaining({
              colorize: true
            })
          }),
          expect.objectContaining({
            level: 'error',
            target: 'pino/file',
            options: expect.any(Object)
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Транспорты через pino.transport созданы успешно')
    }, 2000)

    test('должен обрабатывать специфичные настройки консольного транспорта', () => {
      mockLogger.trace('Тестирование специфичных настроек консольного транспорта')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'console',
        TRANSPORT1_LEVEL: 'info',
        TRANSPORT1_COLORS: 'false',
        TRANSPORT1_TRANSLATE_TIME: 'ISO:yyyy-mm-dd',
        TRANSPORT1_IGNORE: 'hostname,pid,time',
        TRANSPORT1_SINGLE_LINE: 'true',
        TRANSPORT1_HIDE_OBJECT_KEYS: 'password,secret',
        TRANSPORT1_SHOW_METADATA: 'true'
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверка
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            target: 'pino-pretty',
            options: expect.objectContaining({
              colorize: false,
              translateTime: 'ISO:yyyy-mm-dd',
              ignore: 'hostname,pid,time',
              singleLine: true,
              hideObject: ['password', 'secret'],
              messageKey: 'msg',
              levelKey: 'level',
              timestampKey: 'time'
            })
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Специфичные настройки консольного транспорта обработаны')
    }, 2000)

    test('должен обрабатывать специфичные настройки файлового транспорта', () => {
      mockLogger.trace('Тестирование специфичных настроек файлового транспорта')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'file',
        TRANSPORT1_LEVEL: 'error',
        TRANSPORT1_FOLDER: '/var/logs',
        TRANSPORT1_FILENAME: 'error_{date}.log',
        TRANSPORT1_MKDIR: 'true',
        TRANSPORT1_APPEND: 'false',
        TRANSPORT1_SYNC: 'true',
        TRANSPORT1_ROTATE: 'true',
        TRANSPORT1_ROTATE_MAX_SIZE: '5242880',
        TRANSPORT1_ROTATE_MAX_FILES: '10',
        TRANSPORT1_ROTATE_COMPRESS: 'true'
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'error',
            target: 'pino/file',
            options: expect.objectContaining({
              mkdir: true,
              append: false,
              sync: true
            })
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Специфичные настройки файлового транспорта обработаны')
    }, 2000)

    test('должен корректно обрабатывать destination как файловый дескриптор', () => {
      mockLogger.trace('Тестирование destination как файлового дескриптора')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'file',
        TRANSPORT1_LEVEL: 'info',
        TRANSPORT1_DESTINATION: '1', // stdout
        TRANSPORT2: 'file',
        TRANSPORT2_LEVEL: 'error',
        TRANSPORT2_DESTINATION: '2' // stderr
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'info',
            target: 'pino/file',
            options: expect.objectContaining({
              destination: 1 // Числовой дескриптор
            })
          }),
          expect.objectContaining({
            level: 'error',
            target: 'pino/file',
            options: expect.objectContaining({
              destination: 2 // Числовой дескриптор
            })
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Файловые дескрипторы обработаны корректно')
    }, 2000)

    test('должен отфильтровывать отключенные транспорты', () => {
      mockLogger.trace('Тестирование фильтрации отключенных транспортов')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'console',
        TRANSPORT1_LEVEL: 'debug',
        TRANSPORT1_ENABLED: 'false', // Отключен
        TRANSPORT2: 'file',
        TRANSPORT2_LEVEL: 'error',
        TRANSPORT2_FOLDER: '/custom/logs'
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверки - должен быть только один транспорт
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'error',
            target: 'pino/file'
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Отключенные транспорты отфильтрованы')
    }, 2000)

    test('должен создать дефолтный транспорт если все отключены', () => {
      mockLogger.trace('Тестирование создания дефолтного транспорта при отключенных')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'console',
        TRANSPORT1_ENABLED: 'false', // Отключен
        TRANSPORT2: 'file',
        TRANSPORT2_ENABLED: 'false' // Тоже отключен
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверки - должен быть дефолтный транспорт
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'info', // Дефолтный уровень
            target: 'pino-pretty'
          })
        ]
      })

      mockLogger.debug('Создан дефолтный транспорт при отключенных')
    }, 2000)
  })
})
