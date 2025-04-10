/**
 * @file src/logger/logger.js
 * @description Основной модуль подсистемы логирования для создания логгеров с фильтрацией по namespace
 * @version 0.8.4
 *
 * @example
 * Создание логгера:
 * ```javascript
 * // Базовый логгер без namespace
 * const logger = createLogger()
 *
 * // Логгер с namespace для фильтрации
 * const dbLogger = createLogger('database')
 * const queryLogger = createLogger('database:query')
 *
 * // Создание дочернего логгера с дополнительным контекстом
 * const userLogger = dbLogger.child({ userId: 123 });
 * userLogger.info('User operation'); // Лог будет содержать { namespace: 'database', userId: 123 }
 * ```
 *
 * Поддерживаемые уровни логирования:
 * - trace - детальная отладочная информация, входные параметры функций
 * - debug - основная отладочная информация, результаты операций
 * - info - важные события приложения
 * - warn - предупреждения
 * - error - ошибки выполнения
 * - fatal - критические ошибки
 *
 * Варианты вызова методов логирования:
 * ```javascript
 * // 1. Сообщение с плейсхолдерами
 * logger.info('Processing user %s: %j', userId, userData)
 * logger.debug('Request %s completed in %d ms', reqId, duration)
 *
 * // 2. Объект с метаданными и сообщение
 * logger.info({ userId, action: 'login' }, 'User logged in')
 *
 * // 3. Только сообщение
 * logger.info('Application started')
 * logger.warn('Warning message only') // Обрезается при необходимости
 *
 * // 4. Только объект с метаданными
 * logger.debug({ operation: 'query', duration: 150, result: queryResult })
 *
 * // 5. Логирование ошибок
 * try { await operation() } catch (error) { logger.error({ err: error }, 'Operation failed') }
 * ```
 *
 * Дополнительные методы и свойства (аналогично Pino):
 * - `logger.child(bindings)`: Создает дочерний логгер с добавленным контекстом.
 * - `logger.bindings()`: Возвращает текущий контекст (bindings) логгера.
 * - `logger.level`: Позволяет получить или установить уровень логирования для этого экземпляра.
 * - `logger.isLevelEnabled(levelName)`: Проверяет, активен ли данный уровень.
 * - `logger.silent()`: Временно отключает логирование для этого экземпляра.
 *
 * ВАЖНО: Фильтрация логов по namespace через DEBUG
 * - Правила фильтрации применяются на основе `namespace`, переданного в `createLogger`.
 * - Дочерние логгеры, созданные через `.child()`, наследуют `namespace` родителя для фильтрации.
 * - Примеры: `DEBUG=*`, `DEBUG=db:*,api:*`, `DEBUG=*,-db:query`
 */

import pino from 'pino'
import { createTransport } from './config.js'
// Импортируем ошибки и фабрики
import { createTransportError } from './error-fabs-logger.js'
import { LOGGER_ERROR_CODES } from './errors-logger.js'

/**
 * Зависимости модуля для тестирования
 */
export const dependencies = {
  env: process.env,
  pino,
  baseLogger: null, // Базовый pino логгер (инициализируется один раз)
  createTransport, // Из config.js
  Date // Добавляем Date для тестирования
}

/**
 * Устанавливает зависимости модуля для тестирования
 * @param {Partial<typeof dependencies>} newDependencies - Новые зависимости
 */
export function setDependencies (newDependencies) {
  // Сброс baseLogger при изменении зависимостей (особенно env) для тестов
  if (dependencies.env !== newDependencies.env) {
    dependencies.baseLogger = null
  }
  Object.assign(dependencies, newDependencies)
}

/**
 * Поддерживаемые уровни логирования
 * @type {string[]}
 */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']

// --- Внутренние хелперы ---

/**
 * Получает строковый уровень логирования по числовому значению
 * @param {number} level - Числовой уровень логирования
 * @returns {string} Строковый уровень логирования
 * @private
 */
function getLevelName (level) {
  const levelNames = Object.entries(pino.levels.values).reduce((acc, [key, value]) => {
    acc[value] = key
    return acc
  }, {})
  return levelNames[level] || 'info' // Default to 'info'
}

/**
 * Подготавливает значение для логирования с учетом типа данных и настроек
 * @param {*} value - Значение для преобразования
 * @param {number} depth - Максимальная глубина рекурсии (только для Map структур)
 * @param {number} maxStringLength - Максимальная длина строк (0 - без ограничений)
 * @param {string} truncationMarker - Маркер обрезки для длинных строк
 * @returns {*} Преобразованное значение
 * @private
 */
function prepareValueForLogging (value, depth = 8, maxStringLength = 0, truncationMarker = '...') {
  if (typeof value === 'string' && maxStringLength > 0 && value.length > maxStringLength) {
    return value.substring(0, maxStringLength) + truncationMarker
  }

  if (value instanceof Map) {
    if (depth <= 0) return '[Max Map Depth Reached]'
    const obj = {}
    for (const [k, v] of value.entries()) {
      obj[String(k)] = prepareValueForLogging(v, depth - 1, maxStringLength, truncationMarker)
    }
    return obj
  }

  if (Array.isArray(value)) {
    return value.map(item => prepareValueForLogging(item, depth, maxStringLength, truncationMarker))
  }

  if (value && typeof value === 'object' && !(value instanceof Error) && Object.getPrototypeOf(value) === Object.prototype) {
    const result = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = prepareValueForLogging(v, depth, maxStringLength, truncationMarker)
    }
    return result
  }

  return value
}

/**
 * Оборачивает метод логирования pino для добавления кастомной обработки
 * @param {pino.Logger} pinoInstance - Экземпляр логгера pino
 * @param {string} method - Имя метода логирования ('info', 'debug', etc.)
 * @returns {Function} Обертка над методом логгера
 * @private
 */
function wrapLogMethod (pinoInstance, method) {
  return function (...args) {
    if (args.length === 0) return

    const maxDepth = parseInt(dependencies.env.LOG_MAX_DEPTH, 10) || 8
    const maxStringLength = parseInt(dependencies.env.LOG_MAX_STRING_LENGTH, 10) || 0
    const truncationMarker = dependencies.env.LOG_TRUNCATION_MARKER || '...'

    const firstArg = args[0]

    if (firstArg instanceof Error) {
      return pinoInstance[method]({ err: firstArg })
    }

    const formatStringIndex = (typeof firstArg === 'object' && firstArg !== null && !(firstArg instanceof Error)) ? 1 : 0
    const hasInterpolationArgs = args.length > formatStringIndex + 1

    const convertedArgs = args.map((arg, index) => {
      const isFormatString = (index === formatStringIndex && typeof arg === 'string')
      if (isFormatString && hasInterpolationArgs) {
        return arg // Пропускаем форматную строку, если есть что подставлять
      }

      if (arg instanceof Error) return arg
      if (typeof arg === 'object' && arg !== null) {
        return prepareValueForLogging(arg, maxDepth, maxStringLength, truncationMarker)
      }
      // Применяем обрезку ко всем остальным строкам (включая одиночные)
      if (typeof arg === 'string' && maxStringLength > 0 && arg.length > maxStringLength) {
        return arg.substring(0, maxStringLength) + truncationMarker
      }
      return arg
    })

    if (typeof firstArg === 'object' && firstArg !== null && !(firstArg instanceof Error)) {
      const potentialError = firstArg.err
      if (potentialError instanceof Error) {
        const { err, ...rest } = convertedArgs[0]
        return pinoInstance[method]({
          ...rest,
          err: {
            message: potentialError.message,
            stack: potentialError.stack,
            type: potentialError.constructor.name,
            code: potentialError.code
          }
        }, ...convertedArgs.slice(1))
      }
      return pinoInstance[method](...convertedArgs)
    } else {
      return pinoInstance[method](undefined, ...convertedArgs)
    }
  }
}

/**
 * Преобразует паттерн DEBUG в RegExp.
 * @param {string} pattern - Паттерн DEBUG (например, 'app', 'app:*', '*')
 * @returns {RegExp} Регулярное выражение
 * @private
 */
function patternToRegExp (pattern) {
  if (pattern === '*') {
    return /^.*$/
  }
  let regexString
  // Используем lookbehind, чтобы не экранировать * если перед ней \
  if (pattern.endsWith('*') && !pattern.endsWith('\\*') && pattern.length > 1) {
    const prefix = pattern.slice(0, -1)
    const escapedPrefix = prefix.replace(/[\\^$.*+?()[\]{}|:]/g, '\\$&')
    regexString = '^' + escapedPrefix + '.*?' // Нежадный, без $
  } else {
    const escapedPattern = pattern.replace(/[\\^$.*+?()[\]{}|:]/g, '\\$&')
    regexString = '^' + escapedPattern + '$' // Точное совпадение
  }
  try {
    return new RegExp(regexString)
  } catch (e) {
    console.error(`[SYS_LOGGER WARNING] Invalid DEBUG pattern converted to RegExp: "${pattern}". Error: ${e.message}`)
    return /$^/ // Никогда не совпадает
  }
}

/**
 * Вычисляет, активен ли данный namespace согласно переменной DEBUG.
 * Логика основана на поведении модуля `debug`.
 * @param {string|undefined} namespace - Namespace логгера
 * @returns {boolean} true если логи для этого namespace должны выводиться
 * @private
 */
function isNamespaceEnabled (namespace) {
  const debug = dependencies.env.DEBUG

  if (debug === undefined || debug === null) return !namespace
  const trimmedDebug = debug.trim()
  if (trimmedDebug === '') return !namespace

  const patterns = trimmedDebug.split(',').map(p => p.trim()).filter(Boolean)
  if (patterns.length === 0) return !namespace

  const skips = []
  const names = []

  patterns.forEach(pattern => {
    if (pattern.startsWith('-')) {
      skips.push(pattern.substring(1))
    } else {
      names.push(pattern)
    }
  })

  // Логгер без namespace активен только если есть '*' и нет явных запретов
  // (проверяем skips на наличие '*')
  if (!namespace) {
    return names.includes('*') && !skips.includes('*')
  }

  // Проверка негативных правил (сначала более специфичные, потом '*')
  for (const pattern of skips) {
    if (pattern === '*') continue // Обработаем общий запрет позже
    const regex = patternToRegExp(pattern)
    if (regex.test(namespace)) {
      return false // Запрещено специфичным правилом
    }
  }
  // Проверяем общий запрет '*'
  if (skips.includes('*')) {
    return false
  }

  // Проверка позитивных правил (сначала более специфичные, потом '*')
  let allowed = false
  for (const pattern of names) {
    if (pattern === '*') continue // Обработаем общий wildcard позже
    const regex = patternToRegExp(pattern)
    if (regex.test(namespace)) {
      allowed = true // Разрешено специфичным правилом
      break
    }
  }

  // Если не разрешено специфичным правилом, проверяем общий wildcard '*'
  if (!allowed && names.includes('*')) {
    allowed = true
  }

  return allowed
}

/**
 * Создает обертку над экземпляром pino логгера
 * @param {pino.Logger} pinoInstance - Экземпляр pino логгера
 * @param {string|undefined} namespace - Namespace для фильтрации
 * @returns {object} Обертка с методами логирования и доп. методами
 * @private
 */
function _wrapPinoInstance (pinoInstance, namespace) {
  const wrapper = {}
  // Пересчитываем nsEnabled здесь, так как DEBUG мог измениться в тестах
  // между созданием разных логгеров
  const nsEnabled = isNamespaceEnabled(namespace)

  // 1. Методы логирования
  LOG_LEVELS.forEach(level => {
    if (pinoInstance[level]) {
      const wrappedLogFn = wrapLogMethod(pinoInstance, level)
      wrapper[level] = (...args) => {
        // Перепроверяем nsEnabled на момент вызова, чтобы учесть динамические изменения DEBUG (хотя это редкость)
        if (!isNamespaceEnabled(namespace)) return
        return wrappedLogFn(...args)
      }
    }
  })

  // 2. Метод .child()
  wrapper.child = (bindings) => {
    const newPinoChild = pinoInstance.child(bindings)
    // Дочерний логгер все еще фильтруется по *родительскому* namespace
    return _wrapPinoInstance(newPinoChild, namespace)
  }

  // 3. Метод .bindings()
  wrapper.bindings = () => pinoInstance.bindings()

  // 4. Метод .isLevelEnabled()
  wrapper.isLevelEnabled = (levelName) => {
    // Перепроверяем nsEnabled на момент вызова
    return isNamespaceEnabled(namespace) && pinoInstance.isLevelEnabled(levelName)
  }

  // 5. Метод .silent()
  wrapper.silent = () => pinoInstance.silent()

  // 6. Свойство .level
  Object.defineProperty(wrapper, 'level', {
    get: () => pinoInstance.level,
    set: (newLevel) => { pinoInstance.level = newLevel },
    enumerable: true,
    configurable: true
  })

  return wrapper
}

/**
 * Создает базовый pino логгер (синглтон)
 * @param {Object} env - Переменные окружения
 * @returns {pino.Logger} Базовый pino логгер
 * @throws {SystemError} При ошибке инициализации
 * @private
 */
function initializeBaseLogger (env) {
  if (dependencies.baseLogger) {
    return dependencies.baseLogger
  }
  try {
    const { pino, createTransport } = dependencies
    const transportConfig = createTransport(env)

    const options = {
      timestamp: true,
      level: getLevelName(transportConfig.level || pino.levels.values.info)
    }

    dependencies.baseLogger = pino(options, transportConfig.transport)

    if (!dependencies.baseLogger[options.level]) {
      throw new Error(`Logger initialization failed - level '${options.level}' method not found.`)
    }

    return dependencies.baseLogger
  } catch (error) {
    if (error.code === LOGGER_ERROR_CODES.TRANSPORT_INIT_FAILED.code) {
      throw error
    }
    throw createTransportError(`Failed to initialize base logger: ${error.message}`, error)
  }
}

// --- Публичный API ---

/**
 * Создает обертку над pino логгером с фильтрацией по namespace и расширенным API
 * @param {string} [namespace] - Namespace для фильтрации
 * @returns {object} Объект с методами логирования (info, debug...) и доп. методами (child, level...).
 * @throws {SystemError} При ошибке инициализации базового логгера.
 */
export function createLogger (namespace = undefined) {
  try {
    const basePinoLogger = initializeBaseLogger(dependencies.env)
    const pinoInstance = namespace ? basePinoLogger.child({ namespace }) : basePinoLogger
    return _wrapPinoInstance(pinoInstance, namespace)
  } catch (error) {
    console.error(`[SYS_LOGGER FATAL ERROR] Logger creation failed for namespace "${namespace}":`, error)
    throw error
  }
}
