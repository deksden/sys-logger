/**
 * @file test/logger/logger.test.js
 * @description Тесты основного модуля логирования
 * @version 0.7.2
 * @tested-file src/logger/logger.js
 * @tested-file-version 0.8.4
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.3.0.md
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import { dependencies as loggerDeps, setDependencies, createLogger, LOG_LEVELS } from '../../src/logger/logger.js'
import { SystemError } from '@fab33/sys-errors'
import { LOGGER_ERROR_CODES } from '../../src/logger/errors-logger.js'

// Используем реальный логгер для отладки тестов
const testMetaLogger = createLogger('test:logger') // Logger for test file itself

describe('(logger.js) Модуль основного логирования', () => {
  let origDeps = {}
  let mockPino // Mock for pino factory function
  let mockTransport // Mock for createTransport function
  let mockBasePinoInstance // Mock for the *single* base pino instance
  let lastCreatedPinoChildInstance // Helper to track the last pino child instance created

  // Helper to create a more dynamic pino instance mock
  const createPinoMockInstance = (initialLevel = 'trace', initialBindings = {}) => {
    let currentLevel = initialLevel
    const bindings = { ...initialBindings }
    const instance = {}

    // Mock methods
    LOG_LEVELS.forEach(level => {
      instance[level] = vi.fn()
    })

    // Mock .child()
    instance.child = vi.fn((newBindings) => {
      lastCreatedPinoChildInstance = createPinoMockInstance(currentLevel, { ...bindings, ...newBindings })
      return lastCreatedPinoChildInstance
    })

    // Mock .bindings()
    instance.bindings = vi.fn(() => ({ ...bindings })) // Return a copy

    // Mock .isLevelEnabled()
    instance.isLevelEnabled = vi.fn((levelName) => {
      const currentLevelValue = loggerDeps.pino.levels.values[currentLevel] || 30 // default info
      const checkLevelValue = loggerDeps.pino.levels.values[levelName] || 0
      return checkLevelValue >= currentLevelValue
    })

    // Mock .silent()
    instance.silent = vi.fn()

    // Mock .level property
    Object.defineProperty(instance, 'level', {
      get: () => currentLevel,
      set: (newLevel) => { currentLevel = newLevel },
      enumerable: true,
      configurable: true
    })

    return instance
  }

  beforeEach(() => {
    testMetaLogger.trace('Инициализация тестов logger.js')
    origDeps = { ...loggerDeps }

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))

    // Reset mocks
    mockBasePinoInstance = createPinoMockInstance('trace', {})
    lastCreatedPinoChildInstance = null // Reset helper

    mockPino = vi.fn().mockReturnValue(mockBasePinoInstance)
    mockPino.levels = { values: { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } }
    mockPino.transport = vi.fn().mockReturnValue({})

    mockTransport = vi.fn().mockReturnValue({
      transport: { targets: [] },
      level: 10 // trace numerical value
    })

    // Set mocks using DI
    setDependencies({
      env: { LOG_LEVEL: 'trace', LOG_MAX_STRING_LENGTH: '0' }, // Start with default env
      pino: mockPino,
      createTransport: mockTransport,
      baseLogger: null, // Ensure baseLogger is re-initialized
      Date
    })

    testMetaLogger.debug('Моки установлены')
  })

  afterEach(() => {
    testMetaLogger.trace('Восстановление оригинальных зависимостей')
    setDependencies(origDeps)
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('createLogger() - Создание логгера', () => {
    test('создание логгера без namespace', () => {
      testMetaLogger.trace('Тест: создание логгера без namespace')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*' } }) // Allow all

      const testLogger = createLogger()

      expect(mockTransport).toHaveBeenCalledTimes(1)
      expect(mockPino).toHaveBeenCalledTimes(1)
      expect(mockBasePinoInstance.child).not.toHaveBeenCalled()

      testLogger.info('test message')
      expect(mockBasePinoInstance.info).toHaveBeenCalledWith(undefined, 'test message')

      testLogger.trace({ data: 1 })
      expect(mockBasePinoInstance.trace).toHaveBeenCalledWith({ data: 1 })
    })

    test('создание логгера с namespace', () => {
      testMetaLogger.trace('Тест: создание логгера с namespace')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*' } })
      const namespace = 'test:module'
      const testLogger = createLogger(namespace)

      expect(mockTransport).toHaveBeenCalledTimes(1)
      expect(mockPino).toHaveBeenCalledTimes(1)
      expect(mockBasePinoInstance.child).toHaveBeenCalledWith({ namespace })
      expect(lastCreatedPinoChildInstance).toBeDefined()

      testLogger.info('test message')
      expect(lastCreatedPinoChildInstance.info).toHaveBeenCalledWith(undefined, 'test message')
      expect(mockBasePinoInstance.info).not.toHaveBeenCalled()
    })

    test('повторное создание логгера использует существующий baseLogger', () => {
      testMetaLogger.trace('Тест: переиспользование baseLogger')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*' } })

      createLogger('first:ns')
      expect(mockTransport).toHaveBeenCalledTimes(1)
      expect(mockPino).toHaveBeenCalledTimes(1)
      expect(mockBasePinoInstance.child).toHaveBeenCalledWith({ namespace: 'first:ns' })

      mockTransport.mockClear()
      mockPino.mockClear()
      mockBasePinoInstance.child.mockClear()

      createLogger('second:ns')
      expect(mockTransport).not.toHaveBeenCalled()
      expect(mockPino).not.toHaveBeenCalled()
      expect(mockBasePinoInstance.child).toHaveBeenCalledWith({ namespace: 'second:ns' })
    })

    // --- Разделенные тесты фильтрации ---
    test('фильтрация по DEBUG: DEBUG=* разрешает все', () => {
      testMetaLogger.debug('DEBUG=*')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*' } })
      const loggerNoNs = createLogger()
      const loggerNs = createLogger('app:test')
      const nsPinoInstance = lastCreatedPinoChildInstance

      loggerNoNs.info('No NS 1')
      loggerNs.info('With NS 1')

      expect(mockBasePinoInstance.info).toHaveBeenCalledTimes(1)
      expect(mockBasePinoInstance.info).toHaveBeenCalledWith(undefined, 'No NS 1')
      expect(nsPinoInstance.info).toHaveBeenCalledTimes(1)
      expect(nsPinoInstance.info).toHaveBeenCalledWith(undefined, 'With NS 1')
    })

    test('фильтрация по DEBUG: DEBUG= разрешает только без ns', () => {
      testMetaLogger.debug('DEBUG=')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '' } })
      const loggerNoNs = createLogger()
      const loggerNs = createLogger('app:test')
      const nsPinoInstance = lastCreatedPinoChildInstance // Instance for 'app:test'

      loggerNoNs.info('No NS 2') // Should be allowed
      loggerNs.info('With NS 2') // Should be blocked

      expect(mockBasePinoInstance.info).toHaveBeenCalledTimes(1)
      expect(mockBasePinoInstance.info).toHaveBeenCalledWith(undefined, 'No NS 2')
      // Check the specific instance for app:test was not called
      expect(nsPinoInstance?.info).not.toHaveBeenCalled()
    })

    test('фильтрация по DEBUG: DEBUG=app:* разрешает app:test', () => {
      testMetaLogger.debug('DEBUG=app:*')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: 'app:*' } })
      const loggerNoNs = createLogger()
      const loggerNs = createLogger('app:test') // Allowed
      const nsPinoInstance = lastCreatedPinoChildInstance
      const loggerOtherNs = createLogger('other:test') // Blocked

      loggerNoNs.info('No NS 3') // Blocked
      loggerNs.info('With NS 3') // Allowed
      loggerOtherNs.info('Other NS 3') // Blocked

      expect(mockBasePinoInstance.info).not.toHaveBeenCalled()
      expect(nsPinoInstance.info).toHaveBeenCalledTimes(1) // <<--- The failing expect was here
      expect(nsPinoInstance.info).toHaveBeenCalledWith(undefined, 'With NS 3')
      // Check instance for other:test was not called
      expect(lastCreatedPinoChildInstance?.info).not.toHaveBeenCalled() // last... now points to other:test instance
    })

    test('фильтрация по DEBUG: DEBUG=*,-app:test запрещает app:test', () => {
      testMetaLogger.debug('DEBUG=*,-app:test')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*,-app:test' } })

      const loggerNoNs = createLogger()
      const loggerNs = createLogger('app:test') // Blocked by negation
      // Get the mock instance associated with loggerNs for later check
      const nsPinoInstance = lastCreatedPinoChildInstance

      // Create loggerOtherNs *after* loggerNs
      const loggerOtherNs = createLogger('other:test') // Allowed by *
      const otherNsPinoInstance = lastCreatedPinoChildInstance // Now this holds the mock for other:test

      loggerNoNs.info('No NS 4') // Allowed by *
      loggerNs.info('With NS 4') // Blocked call
      loggerOtherNs.info('Other NS 4') // Allowed call

      // Check base logger call
      expect(mockBasePinoInstance.info).toHaveBeenCalledTimes(1)
      expect(mockBasePinoInstance.info).toHaveBeenCalledWith(undefined, 'No NS 4')

      // Check the mock instance for other:test was called
      expect(otherNsPinoInstance.info).toHaveBeenCalledTimes(1) // <<--- This was the failing expect
      expect(otherNsPinoInstance.info).toHaveBeenCalledWith(undefined, 'Other NS 4')

      // Check the mock instance for app:test was NOT called
      expect(nsPinoInstance.info).not.toHaveBeenCalled()
    })
    // --- Конец разделенных тестов фильтрации ---

    test('поддержка различных вариантов вызова методов', () => {
      testMetaLogger.trace('Тест: различные варианты вызова')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*' } })
      const testLogger = createLogger('call:variants')
      const pinoInstance = lastCreatedPinoChildInstance

      const testObj = { field: 'value' }
      const testMsg = 'test message'
      const testError = new Error('test error')
      testError.code = 'TEST_ERR'

      testLogger.info(testObj)
      expect(pinoInstance.info).toHaveBeenCalledWith(testObj)
      pinoInstance.info.mockClear()

      testLogger.info(testMsg)
      expect(pinoInstance.info).toHaveBeenCalledWith(undefined, testMsg)
      pinoInstance.info.mockClear()

      testLogger.info(testObj, testMsg)
      expect(pinoInstance.info).toHaveBeenCalledWith(testObj, testMsg)
      pinoInstance.info.mockClear()

      testLogger.info('%s value: %d', 'string', 123)
      expect(pinoInstance.info).toHaveBeenCalledWith(undefined, '%s value: %d', 'string', 123)
      pinoInstance.info.mockClear()

      testLogger.error(testError)
      expect(pinoInstance.error).toHaveBeenCalledWith({ err: testError })
      pinoInstance.error.mockClear()

      testLogger.error({ data: 'abc', err: testError }, 'Operation failed')
      expect(pinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({
          data: 'abc',
          err: {
            message: 'test error',
            stack: expect.any(String),
            type: 'Error',
            code: 'TEST_ERR'
          }
        }),
        'Operation failed'
      )
    })

    test('корректно логирует Map', () => {
      testMetaLogger.trace('Тест: логирование Map')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*' } })
      const testLogger = createLogger('map:test')
      const pinoInstance = lastCreatedPinoChildInstance
      const testMap = new Map([['key1', 'value1'], ['key2', new Map([['nested', 'value']])]])

      testLogger.info({ mapData: testMap })
      expect(pinoInstance.info).toHaveBeenCalledWith({
        mapData: { key1: 'value1', key2: { nested: 'value' } }
      })
    })

    test('соблюдает настраиваемую глубину для Map структур', () => {
      testMetaLogger.trace('Тест: настраиваемая глубина Map')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*', LOG_MAX_DEPTH: '2' } })
      const testLogger = createLogger('map:depth')
      const pinoInstance = lastCreatedPinoChildInstance
      const deepMap = new Map([['l1', new Map([['l2', new Map([['l3', 'too deep']])]])]])

      testLogger.info({ deep: deepMap })
      expect(pinoInstance.info).toHaveBeenCalledWith({
        deep: { l1: { l2: '[Max Map Depth Reached]' } }
      })
    })

    test('обрабатывает обычные объекты без ограничения глубины', () => {
      testMetaLogger.trace('Тест: обычные объекты без ограничения глубины')
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*', LOG_MAX_DEPTH: '2' } })
      const testLogger = createLogger('obj:depth')
      const pinoInstance = lastCreatedPinoChildInstance
      const deepObj = { l1: { l2: { l3: { l4: 'deep value' } } } }

      testLogger.info({ deep: deepObj })
      expect(pinoInstance.info).toHaveBeenCalledWith({ deep: deepObj })
    })

    test('ограничение длины строк работает', () => {
      testMetaLogger.trace('Тест: обрезка строк')
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '*', LOG_MAX_STRING_LENGTH: '10', LOG_TRUNCATION_MARKER: '~' }
      })
      const testLogger = createLogger('string:limit')
      const pinoInstance = lastCreatedPinoChildInstance
      const longString = '1234567890abcdef'

      // String in object
      testLogger.info({ long: longString })
      expect(pinoInstance.info).toHaveBeenCalledWith({ long: '1234567890~' })
      pinoInstance.info.mockClear()

      // String as placeholder value
      testLogger.info('Message: %s', longString)
      expect(pinoInstance.info).toHaveBeenCalledWith(undefined, 'Message: %s', '1234567890~')
      pinoInstance.info.mockClear()

      // String as single argument
      testLogger.warn(longString)
      expect(pinoInstance.warn).toHaveBeenCalledWith(undefined, '1234567890~')
    })

    test('ошибка при инициализации транспорта', () => {
      testMetaLogger.trace('Тест: ошибка инициализации транспорта')
      const initError = new Error('Transport failed')
      setDependencies({
        ...loggerDeps,
        baseLogger: null,
        createTransport: vi.fn().mockImplementation(() => { throw initError }),
        pino: mockPino
      })

      expect(() => createLogger()).toThrow(SystemError)
      try {
        createLogger()
      } catch (e) {
        expect(e.code).toBe(LOGGER_ERROR_CODES.TRANSPORT_INIT_FAILED.code)
        expect(e.message).toContain('Failed to initialize base logger')
        expect(e.original).toBe(initError)
      }
    })
  })

  describe('Дополнительные методы логгера', () => {
    let parentLogger
    let parentPinoInstance
    let childLogger
    let childPinoInstance

    beforeEach(() => {
      setDependencies({ ...loggerDeps, env: { ...loggerDeps.env, DEBUG: '*' } })
      parentLogger = createLogger('parent')
      parentPinoInstance = lastCreatedPinoChildInstance

      childLogger = parentLogger.child({ extra: 'data' })
      childPinoInstance = lastCreatedPinoChildInstance
    })

    test('метод .child() создает дочерний логгер', () => {
      testMetaLogger.trace('Тест: метод .child()')
      expect(parentLogger.child).toBeInstanceOf(Function)
      expect(parentPinoInstance.child).toHaveBeenCalledWith({ extra: 'data' })
      expect(childLogger).toBeDefined()
      expect(childLogger.info).toBeInstanceOf(Function)
      expect(childPinoInstance).toBeDefined()
    })

    test('дочерний логгер наследует namespace и добавляет bindings', () => {
      testMetaLogger.trace('Тест: наследование namespace и bindings')
      expect(childPinoInstance.bindings()).toEqual({ namespace: 'parent', extra: 'data' })

      childLogger.info('Child message')
      expect(childPinoInstance.info).toHaveBeenCalledWith(undefined, 'Child message')
      expect(parentPinoInstance.info).not.toHaveBeenCalled()
    })

    test('фильтрация DEBUG работает для дочерних логгеров', () => {
      testMetaLogger.trace('Тест: DEBUG фильтрация для .child()')
      const origEnv = { ...loggerDeps.env }

      // Случай 1: Разрешено родителю (parent)
      setDependencies({ ...loggerDeps, env: { ...origEnv, DEBUG: 'parent' } })
      parentLogger = createLogger('parent')
      parentPinoInstance = lastCreatedPinoChildInstance
      const child1 = parentLogger.child({ id: 1 })
      const child1PinoInstance = lastCreatedPinoChildInstance
      child1.info('Child log 1')
      expect(child1PinoInstance.info).toHaveBeenCalledTimes(1)
      child1PinoInstance.info.mockClear()

      // Случай 2: Запрещено родителю (parent)
      setDependencies({ ...loggerDeps, env: { ...origEnv, DEBUG: 'other' } })
      parentLogger = createLogger('parent')
      parentPinoInstance = lastCreatedPinoChildInstance
      const child2 = parentLogger.child({ id: 2 })
      const child2PinoInstance = lastCreatedPinoChildInstance
      child2.info('Child log 2')
      expect(child2PinoInstance.info).not.toHaveBeenCalled()

      // Случай 3: Запрещено через отрицание
      setDependencies({ ...loggerDeps, env: { ...origEnv, DEBUG: '*,-parent' } })
      parentLogger = createLogger('parent')
      parentPinoInstance = lastCreatedPinoChildInstance
      const child3 = parentLogger.child({ id: 3 })
      const child3PinoInstance = lastCreatedPinoChildInstance
      child3.info('Child log 3')
      expect(child3PinoInstance.info).not.toHaveBeenCalled()

      setDependencies({ ...loggerDeps, env: origEnv }) // Restore env
    })

    test('метод .bindings() возвращает корректные bindings', () => {
      testMetaLogger.trace('Тест: метод .bindings()')
      const loggerNoNs = createLogger()
      const loggerWithNs = createLogger('with:ns')
      const firstChild = lastCreatedPinoChildInstance
      const childOfNs = loggerWithNs.child({ req: 1 })
      const grandChild = lastCreatedPinoChildInstance

      expect(loggerNoNs.bindings()).toEqual({})
      expect(loggerWithNs.bindings()).toEqual({ namespace: 'with:ns' })
      expect(childOfNs.bindings()).toEqual({ namespace: 'with:ns', req: 1 })
    })

    test('свойство .level позволяет получать и устанавливать уровень', () => {
      testMetaLogger.trace('Тест: свойство .level')
      parentPinoInstance.level = 'info'
      expect(parentLogger.level).toBe('info')

      parentLogger.level = 'debug'
      expect(parentPinoInstance.level).toBe('debug')
    })

    test('метод .isLevelEnabled() проверяет активность уровня и DEBUG', () => {
      testMetaLogger.trace('Тест: метод .isLevelEnabled()')
      const origEnv = { ...loggerDeps.env }

      // --- Enabled Case ---
      setDependencies({ ...loggerDeps, env: { ...origEnv, DEBUG: 'isenabled:*' } })
      const enabledLogger = createLogger('isenabled:test')
      const enabledPinoInstance = lastCreatedPinoChildInstance
      enabledPinoInstance.level = 'info'

      expect(enabledLogger.isLevelEnabled('info')).toBe(true)
      expect(enabledPinoInstance.isLevelEnabled).toHaveBeenCalledWith('info')
      expect(enabledLogger.isLevelEnabled('debug')).toBe(false)
      expect(enabledPinoInstance.isLevelEnabled).toHaveBeenCalledWith('debug')
      enabledPinoInstance.isLevelEnabled.mockClear()

      // --- Disabled by DEBUG Case ---
      setDependencies({ ...loggerDeps, env: { ...origEnv, DEBUG: 'other' } })
      const disabledLogger = createLogger('isenabled:test')
      const disabledPinoInstance = lastCreatedPinoChildInstance
      disabledPinoInstance.level = 'info'

      expect(disabledLogger.isLevelEnabled('info')).toBe(false) // <<--- The failing expect was here
      expect(disabledPinoInstance.isLevelEnabled).not.toHaveBeenCalled()

      setDependencies({ ...loggerDeps, env: origEnv })
    })

    test('метод .silent() вызывает pino.silent()', () => {
      testMetaLogger.trace('Тест: метод .silent()')
      parentLogger.silent()
      expect(parentPinoInstance.silent).toHaveBeenCalledTimes(1)
    })

    test('обработка Map и строк работает в дочерних логгерах', () => {
      testMetaLogger.trace('Тест: обработка Map и строк в .child()')
      setDependencies({
        ...loggerDeps,
        env: { ...loggerDeps.env, DEBUG: '*', LOG_MAX_STRING_LENGTH: '5', LOG_MAX_DEPTH: '1' }
      })
      const parent = createLogger('parent:child:test')
      const child = parent.child({ id: 123 })
      const childInstance = lastCreatedPinoChildInstance

      const myMap = new Map([['a', new Map([['b', 'c']])]])
      const longStr = '123456789'

      child.info({ map: myMap, str: longStr })
      expect(childInstance.info).toHaveBeenCalledWith({
        map: { a: '[Max Map Depth Reached]' },
        str: '12345...'
      })
    })
  })
})
