/**
 * @file test/logger/config.test.js
 * @version 0.6.0
 * @description Тесты модуля конфигурации логгера
 *
 * @changelog
 * - 0.6.0 (2025-06-11): Исправлен неполный мок `fs`, который был истинной причиной падения тестов.
 *                      Падавший тест возвращен к простому и читаемому виду.
 * - 0.5.0 (2025-06-11): Рефакторинг падающего теста для изоляции зависимостей.
 * - 0.4.0 (2025-06-11): Добавлены тесты на отказоустойчивость и приоритеты.
 *
 * @tested-file src/logger/config.js
 * @tested-file-version 0.8.0
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.1.0.md
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createLogger } from '../../src/logger/logger.js'
import { createTransport, loadConfig, processFilenameTemplate, setDependencies } from '../../src/logger/config.js'
import { SystemError } from '@fab33/sys-errors'
import { LOGGER_ERROR_CODES } from '../../src/logger/errors-logger.js'

describe('(config.js) Модуль конфигурации логгера', () => {
  let mockDeps
  let mockLogger
  let prettyOptions
  let consoleErrorSpy // Шпион для console.error

  beforeEach(() => {
    mockLogger = createLogger('test:logger:config')

    // Устанавливаем фиксированное время для тестов
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
    // Добавляем мок для Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => new Date().getTime())
    // Шпионим за console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

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
        mkdirSync: vi.fn(),
        accessSync: vi.fn(), // Мок для проверки доступа
        constants: { W_OK: 2 } // ИСПРАВЛЕНИЕ: Добавляем недостающие константы
      },
      path: {
        join: vi.fn((...args) => args.join('/')),
        dirname: vi.fn().mockImplementation(p => p.substring(0, p.lastIndexOf('/')))
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
    consoleErrorSpy.mockRestore() // Восстанавливаем оригинальный console.error
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
        expect(true).toBe(false, 'Ожидалась ошибка при создании директории логов')
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

    // ИСПРАВЛЕНИЕ: Возвращаем тест к простому виду после исправления мока.
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
      mockDeps.fs.readFileSync.mockReturnValue('{"name": "test-app"}')

      // Действие
      const result = createTransport(mockDeps.env)

      // Проверки
      expect(result).toEqual({
        level: 20, // debug (минимальный из заданных уровней)
        transport: expect.any(Object)
      })

      // Проверяем вызов pino.transport с правильными параметрами
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'debug',
            target: 'pino-pretty'
          }),
          expect.objectContaining({
            level: 'error',
            target: 'pino/file'
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Транспорты через pino.transport созданы успешно')
    }, 2000)

    test('должен использовать pino-pretty для file транспорта с destination: 1 и prettyPrint: true', () => {
      mockLogger.trace('Тестирование pretty-print для stdout через file транспорт')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'file',
        TRANSPORT1_LEVEL: 'info',
        TRANSPORT1_DESTINATION: '1', // stdout
        TRANSPORT1_PRETTY_PRINT: 'true', // Явно включаем форматирование
        TRANSPORT1_SYNC: 'true'
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'info',
            target: 'pino-pretty', // Проверяем, что используется правильный таргет
            options: expect.objectContaining({
              destination: 1, // Проверяем, что дескриптор передан
              colorize: true,
              sync: true
            })
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Форматированный вывод в stdout через file транспорт настроен корректно')
    }, 2000)

    test('должен использовать pino/file для file транспорта с destination: 1 без prettyPrint', () => {
      mockLogger.trace('Тестирование raw вывода для stdout через file транспорт')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'file',
        TRANSPORT1_LEVEL: 'info',
        TRANSPORT1_DESTINATION: '1' // stdout
        // PRETTY_PRINT по умолчанию false
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      expect(mockDeps.pino.transport).toHaveBeenCalledWith({
        targets: [
          expect.objectContaining({
            level: 'info',
            target: 'pino/file', // Проверяем, что используется таргет для сырого вывода
            options: expect.objectContaining({
              destination: 1 // Проверяем, что дескриптор передан
            })
          })
        ],
        dedupe: false
      })

      mockLogger.debug('Сырой вывод в stdout через file транспорт настроен корректно')
    }, 2000)

    test('должен отключить файловый транспорт при ошибке доступа к директории и не падать', () => {
      mockLogger.trace('Тестирование отказоустойчивости при ошибке доступа')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'file',
        TRANSPORT1_FOLDER: '/read-only-dir/logs'
      }

      // Симулируем ошибку доступа
      mockDeps.fs.existsSync.mockReturnValue(true)
      mockDeps.fs.accessSync.mockImplementation((path) => {
        if (path.startsWith('/read-only-dir')) {
          throw new Error('EACCES: permission denied')
        }
      })

      // Действие
      const result = createTransport(mockDeps.env)

      // Проверки
      expect(result).toBeDefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[SYS_LOGGER FATAL] Failed to access or create log directory'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('The file transport for this directory will be disabled.'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[SYS_LOGGER WARNING] All configured transports failed to initialize.'))

      // Проверяем, что был создан fallback-транспорт
      expect(mockDeps.pino.transport).toHaveBeenCalledWith(expect.objectContaining({
        targets: [expect.objectContaining({ target: 'pino-pretty', level: 'info' })]
      }))

      mockLogger.debug('Ошибка доступа обработана корректно, логгер не упал')
    }, 2000)

    test('должен отключить только нерабочий транспорт и оставить рабочий', () => {
      mockLogger.trace('Тестирование смеси рабочих и нерабочих транспортов')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'console',
        TRANSPORT1_LEVEL: 'debug',
        TRANSPORT2: 'file',
        TRANSPORT2_FOLDER: '/read-only-dir/logs'
      }

      mockDeps.fs.accessSync.mockImplementation((path) => {
        if (path.startsWith('/read-only-dir')) throw new Error('Permission Denied')
      })

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[SYS_LOGGER FATAL]'))
      const calledWith = mockDeps.pino.transport.mock.calls[0][0]
      expect(calledWith.targets).toHaveLength(1)
      expect(calledWith.targets[0]).toMatchObject({
        level: 'debug',
        target: 'pino-pretty'
      })

      mockLogger.debug('Нерабочий транспорт отфильтрован, рабочий остался')
    }, 2000)

    test('должен игнорировать легаси настройки (LOG_FILE_OUTPUT), если задан TRANSPORT1', () => {
      mockLogger.trace('Тестирование приоритета TRANSPORT{N} над легаси настройками')

      // Подготовка
      mockDeps.env = {
        TRANSPORT1: 'console',
        TRANSPORT1_LEVEL: 'debug',
        LOG_FILE_OUTPUT: 'true',
        LOG_CONSOLE_OUTPUT: 'false',
        LOG_FOLDER: 'legacy-logs'
      }

      // Действие
      createTransport(mockDeps.env)

      // Проверки
      expect(mockDeps.pino.transport).toHaveBeenCalled()
      expect(mockDeps.pino.multistream).not.toHaveBeenCalled()
      const transportCallArgs = mockDeps.pino.transport.mock.calls[0][0]
      expect(transportCallArgs.targets).toHaveLength(1)
      expect(transportCallArgs.targets[0]).toMatchObject({
        level: 'debug',
        target: 'pino-pretty'
      })
      expect(mockDeps.fs.mkdirSync).not.toHaveBeenCalled()

      mockLogger.debug('Легаси настройки корректно проигнорированы при наличии TRANSPORT1')
    }, 2000)
  })
})
