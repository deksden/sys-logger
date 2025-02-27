/**
 * @file test/logger/logger.test.js
 * @description Тесты основного модуля логирования
 * @version 0.6.3
 * @tested-file src/logger/logger.js
 * @tested-file-version 0.6.2
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.3.0.md
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import { dependencies as loggerDeps, setDependencies, createLogger, LOG_LEVELS } from '../../src/logger/logger.js'
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

    // Устанавливаем фиксированное время для тестов
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
    // Добавляем мок для Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => new Date().getTime())

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
      level: 10 // trace
    })

    // Устанавливаем моки
    setDependencies({
      env: { DEBUG: '*', LOG_LEVEL: 'trace' },
      pino: mockPino,
      createTransport: mockTransport,
      baseLogger: mockPinoLogger, // Устанавливаем мок логгера
      Date // Обязательно включаем мок для Date
    })

    logger.debug('Моки установлены')
  })

  afterEach(() => {
    logger.trace('Восстановление оригинальных зависимостей')
    setDependencies(origDeps)
    vi.clearAllMocks()
    vi.useRealTimers()
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

    test('корректно логирует Map в разных форматах вызова', () => {
      logger.trace('Тест: логирование Map в разных форматах')

      const testLogger = createLogger()
      const testMap = new Map([
        ['key1', 'value1'],
        ['key2', new Map([['nested', 'value']])]
      ])

      // Тест 1: Объект с Map как первый аргумент
      const testObj = {
        normalField: 'test',
        mapField: testMap
      }
      testLogger.info(testObj)

      // Тест 2: Map в плейсхолдерах
      testLogger.info('Test data: %j', { map: testMap })

      // Тест 3: Контекст с Map + сообщение с Map в плейсхолдере
      testLogger.info(
        { context: testMap },
        'Message with map: %j',
        { anotherMap: testMap }
      )

      // Проверяем вызовы
      expect(mockPinoLogger.info).toHaveBeenNthCalledWith(1, {
        normalField: 'test',
        mapField: {
          key1: 'value1',
          key2: {
            nested: 'value'
          }
        }
      })

      expect(mockPinoLogger.info).toHaveBeenNthCalledWith(2,
        undefined,
        'Test data: %j',
        {
          map: {
            key1: 'value1',
            key2: {
              nested: 'value'
            }
          }
        }
      )

      expect(mockPinoLogger.info).toHaveBeenNthCalledWith(3,
        {
          context: {
            key1: 'value1',
            key2: {
              nested: 'value'
            }
          }
        },
        'Message with map: %j',
        {
          anotherMap: {
            key1: 'value1',
            key2: {
              nested: 'value'
            }
          }
        }
      )

      logger.debug('Map структуры преобразованы корректно во всех форматах')
    })
    test('соблюдает настраиваемую глубину для Map структур', () => {
      logger.trace('Тест: настраиваемая глубина для Map структур')

      // Устанавливаем настройки глубины через переменные окружения
      setDependencies({
        ...loggerDeps,
        env: {
          DEBUG: '*',
          LOG_LEVEL: 'trace',
          LOG_MAX_DEPTH: '3',  // Глубина 3 для Map структур
          LOG_MAP_DEPTH_ONLY: 'true' // Этот параметр теперь зарезервирован
        },
        baseLogger: mockPinoLogger,
        Date
      })

      const testLogger = createLogger()

      // Создаем глубоко вложенную Map структуру
      const deepMap = new Map([
        ['level1', new Map([
          ['level2', new Map([
            ['level3', new Map([
              ['level4', 'too deep']
            ])]
          ])]
        ])]
      ])

      // Логируем структуру
      testLogger.info({ deep: deepMap })

      // Проверяем, что глубина ограничена после уровня level3
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        deep: {
          level1: {
            level2: {
              level3: '[Max Map Depth Reached]'
            }
          }
        }
      })

      logger.debug('Глубина Map структур ограничена согласно LOG_MAX_DEPTH')
    })
    test('обрабатывает обычные объекты без ограничения глубины при mapDepthOnly=true', () => {
      logger.trace('Тест: обработка обычных объектов без ограничения глубины')

      // Устанавливаем настройки глубины через переменные окружения
      setDependencies({
        ...loggerDeps,
        env: {
          DEBUG: '*',
          LOG_LEVEL: 'trace',
          LOG_MAX_DEPTH: '3',  // Глубина 3 для Map
          LOG_MAP_DEPTH_ONLY: 'true' // Ограничиваем только Map
        },
        baseLogger: mockPinoLogger,
        Date // Не забываем включить Date
      })

      const testLogger = createLogger()

      // Создаем глубоко вложенный обычный объект
      const deepObj = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep value'
                }
              }
            }
          }
        }
      }

      // Логируем структуру
      testLogger.info({ deep: deepObj })

      // Проверяем что объект логируется полностью, без ограничений
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        deep: deepObj
      })

      logger.debug('Обычные объекты не ограничиваются по глубине при mapDepthOnly=true')
    })

    test('ограничивает глубину только для Map структур независимо от mapDepthOnly', () => {
      logger.trace('Тест: ограничение глубины только для Map структур')

      // Настройка с mapDepthOnly=false не должна влиять на результат,
      // т.к. мы теперь всегда ограничиваем только Map структуры
      setDependencies({
        ...loggerDeps,
        env: {
          DEBUG: '*',
          LOG_LEVEL: 'trace',
          LOG_MAX_DEPTH: '2',  // Малая глубина для наглядности
          LOG_MAP_DEPTH_ONLY: 'false' // Теперь этот параметр не влияет на обычные объекты
        },
        baseLogger: mockPinoLogger,
        Date
      })

      const testLogger = createLogger()

      // Обычный объект с глубокой вложенностью
      const deepObj = {
        level1: {
          level2: {
            level3: {
              value: 'deep value'
            }
          }
        }
      }

      // Map объект с глубокой вложенностью
      const deepMap = new Map([
        ['level1', new Map([
          ['level2', new Map([
            ['level3', 'deep value']
          ])]
        ])]
      ])

      // Вызов метода логирования
      testLogger.info({ deepObj, deepMap })

      // Проверка что обычные объекты НЕ ограничены по глубине
      // а Map объекты ограничены на уровне level2
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        deepObj: {
          level1: {
            level2: {
              level3: {
                value: 'deep value'
              }
            }
          }
        },
        deepMap: {
          level1: {
            level2: '[Max Map Depth Reached]'
          }
        }
      })

      logger.debug('Map структуры ограничены по глубине, обычные объекты - нет')
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
        baseLogger: mockPinoLogger,
        Date // Не забываем включить Date
      })

      let testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).not.toHaveBeenCalled()

      // Тест 2: DEBUG=* разрешает все логи
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '*' },
        baseLogger: mockPinoLogger,
        Date // Не забываем включить Date
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, 'test')

      // Тест 3: Разрешающий паттерн
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: 'app:*' },
        baseLogger: mockPinoLogger,
        Date // Не забываем включить Date
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, 'test')

      // Тест 4: Запрещающий паттерн
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '*,-app:test' },
        baseLogger: mockPinoLogger,
        Date // Не забываем включить Date
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).not.toHaveBeenCalled()

      // Тест 5: Пробелы в DEBUG обрабатываются корректно
      mockPinoLogger.info.mockClear()
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '  app:*  ' },
        baseLogger: mockPinoLogger,
        Date // Не забываем включить Date
      })

      testLogger = createLogger('app:test')
      testLogger.info('test')
      expect(mockPinoLogger.info).toHaveBeenCalledWith(undefined, 'test')

      // Восстанавливаем окружение
      setDependencies({
        ...loggerDeps,
        env: origEnv,
        Date // Не забываем включить Date
      })
    })

    test('создание логгера при отсутствии baseLogger с множественными транспортами', () => {
      logger.trace('Тест: создание с множественными транспортами')

      // Настраиваем моки для множественных транспортов
      const mockMultiTransport = {
        // Имитация транспорта созданного через pino.transport
        pipe: undefined, // Не stream/multistream
        write: vi.fn(),
        end: vi.fn()
      }

      // Создаем полноценный мок логгера с методами для всех уровней логирования
      const fullMockLogger = {}
      LOG_LEVELS.forEach(level => {
        fullMockLogger[level] = vi.fn()
      })
      fullMockLogger.child = vi.fn().mockReturnThis()

      // Удаляем baseLogger и настраиваем createTransport для возврата множественных транспортов
      setDependencies({
        ...loggerDeps,
        baseLogger: null,
        createTransport: vi.fn().mockReturnValue({
          level: 10, // trace
          transport: mockMultiTransport // Транспорт для worker threads
        }),
        // Создаем новый мок для pino с transport методом
        pino: vi.fn().mockReturnValue(fullMockLogger),
        Date // Не забываем включить Date
      })

      // Переопределяем метод transport для нашего мока pino
      loggerDeps.pino.transport = vi.fn().mockReturnValue(mockMultiTransport)

      // Создаем логгер
      const testLogger = createLogger()

      // Проверяем что createTransport был вызван
      expect(loggerDeps.createTransport).toHaveBeenCalled()

      // Проверяем работу логгера
      testLogger.info('test')
      expect(fullMockLogger.info).toHaveBeenCalledWith(undefined, 'test')
    })

    test('ошибка при инициализации транспорта', () => {
      logger.trace('Тест: ошибка инициализации')

      // Убираем baseLogger и вызываем ошибку в транспорте
      setDependencies({
        ...loggerDeps,
        baseLogger: null,
        createTransport: vi.fn().mockImplementation(() => {
          throw new Error('Transport failed')
        }),
        Date // Не забываем включить Date
      })

      try {
        createLogger()
        expect(true).toBe(false) // Если не выбросило ошибку - тест должен упасть
      } catch (error) {
        expect(error.message).toContain('Failed to initialize base logger')
      }
    })

    test('обработка ошибки неверного уровня логирования', () => {
      logger.trace('Тест: ошибка неверного уровня')

      // Убираем baseLogger и возвращаем транспорт с неверным уровнем
      setDependencies({
        ...loggerDeps,
        baseLogger: null,
        createTransport: vi.fn().mockReturnValue({
          level: 999, // Несуществующий уровень
          transport: {}
        }),
        pino: mockPino,
        Date // Не забываем включить Date
      })

      // Переопределяем mockPinoLogger, убирая методы логирования
      const invalidLogger = {}
      mockPino.mockReturnValue(invalidLogger)

      try {
        createLogger()
        expect(true).toBe(false) // Если не выбросило ошибку - тест должен упасть
      } catch (error) {
        // Исправлен тест: проверяем сообщение в оригинальной ошибке согласно паттерну SYS_ERRORS
        expect(error.original?.message || error.message).toContain('invalid level')
      }
    })

    test('преобразует обычные объекты без ограничений независимо от mapDepthOnly', () => {
      logger.trace('Тест: преобразование обычных объектов без ограничений')

      // Настройка с разным поведением для обычных объектов
      const tests = [
        {
          env: { LOG_MAX_DEPTH: '2', LOG_MAP_DEPTH_ONLY: 'true' }, // Только Map
          expectLimited: false // Ожидаем, что обычные объекты не будут ограничены
        },
        {
          env: { LOG_MAX_DEPTH: '2', LOG_MAP_DEPTH_ONLY: 'false' }, // Все объекты
          expectLimited: false // Теперь ожидаем, что обычные объекты НЕ будут ограничены никогда
        }
      ]

      // Тестовый объект с глубокой вложенностью
      const deepObject = {
        level1: {
          level2: {
            level3: {
              value: 'deep value'
            }
          }
        }
      }

      for (const testCase of tests) {
        mockPinoLogger.info.mockClear()

        setDependencies({
          ...loggerDeps,
          env: { ...loggerDeps.env, ...testCase.env },
          baseLogger: mockPinoLogger,
          Date
        })

        const testLogger = createLogger()
        testLogger.info({ deep: deepObject })

        // Проверяем, что глубина никогда не ограничена для обычных объектов
        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          deep: deepObject // Полный объект без ограничений
        })
      }

      logger.debug('Обычные объекты всегда обрабатываются без ограничений глубины')
    })
    test('корректно обрабатывает вложенные ошибки', () => {
      logger.trace('Тест: обработка вложенных ошибок')

      const testLogger = createLogger()

      // Объект с вложенной ошибкой
      const originalError = new Error('Original error')
      originalError.code = 'ERR_ORIGINAL'

      const objectWithError = {
        operation: 'test',
        timestamp: Date.now(),
        err: originalError
      }

      testLogger.error(objectWithError, 'Operation failed')

      // Проверяем корректное преобразование ошибки
      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'test',
          timestamp: expect.any(Number),
          err: {
            message: 'Original error',
            stack: expect.any(String),
            type: 'Error',
            code: 'ERR_ORIGINAL'
          }
        }),
        'Operation failed'
      )

      logger.debug('Вложенные ошибки корректно обработаны')
    })

    test('использует значения по умолчанию для настроек глубины Map структур', () => {
      logger.trace('Тест: значения по умолчанию для настроек глубины')

      // Настройка без явного указания LOG_MAX_DEPTH
      setDependencies({
        ...loggerDeps,
        env: { DEBUG: '*', LOG_LEVEL: 'trace' }, // Без настроек глубины
        baseLogger: mockPinoLogger,
        Date
      })

      const testLogger = createLogger()

      // Создаем очень глубоко вложенную Map структуру для проверки дефолта
      const deepMap = new Map()
      let current = deepMap

      // Создаем цепочку из 10 уровней вложенности
      for (let i = 0; i < 10; i++) {
        const nextLevel = new Map()
        current.set(`level${i}`, nextLevel)
        current = nextLevel
      }

      current.set('value', 'deep value')

      // Логируем структуру
      testLogger.info({ deep: deepMap })

      // Проверяем что глубина ограничена на дефолтном уровне (8)
      // Так как depth=8 у нас означает, что можно обработать 8 уровней вложенности
      // Уровень 0 (root) -> level0 -> level1 -> ... -> level7 -> [Max Map Depth Reached]
      const expectedOutput = {
        deep: {
          level0: {
            level1: {
              level2: {
                level3: {
                  level4: {
                    level5: {
                      level6: {
                        level7: '[Max Map Depth Reached]'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      expect(mockPinoLogger.info).toHaveBeenCalledWith(expectedOutput)

      logger.debug('Дефолтные настройки глубины для Map работают корректно')
    })
  })
})
