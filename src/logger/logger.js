/**
 * @file src/logger/logger.js
 * @description Основной модуль подсистемы логирования для создания логгеров с фильтрацией по namespace
 * @version 0.7.0
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
 *
 * // 4. Только объект с метаданными
 * logger.debug({
 *   operation: 'query',
 *   duration: 150,
 *   result: queryResult
 * })
 *
 * // 5. Логирование ошибок
 * try {
 *   await operation()
 * } catch (error) {
 *   logger.error({ err: error }, 'Operation failed')
 * }
 * ```
 *
 * ВАЖНО: Фильтрация логов по namespace через DEBUG
 *
 * По умолчанию при пустом DEBUG все логи блокируются.
 * Чтобы включить логи, необходимо явно указать разрешенные namespace.
 *
 * Примеры:
 * ```
 * # Разрешить все логи (обязательно указать *)
 * DEBUG=*
 *
 * # Только определенные подсистемы
 * DEBUG=database:*,api:*
 *
 * # Исключение подсистем
 * DEBUG=*,-database:metrics
 *
 * # Пустой DEBUG - все логи блокируются
 * DEBUG=
 * ```
 *
 * Особенности поведения:
 * 1. Фильтрация по namespace применяется только если у логгера задан namespace
 * 2. Базовый логгер без namespace не фильтруется
 * 3. Пустой DEBUG блокирует все логи с namespace
 * 4. Для разрешения всех логов нужно явно указать DEBUG=*
 * 5. Паттерны обрабатываются слева направо
 * 6. Отрицательные паттерны (-namespace) имеют приоритет
 */

import pino from 'pino'
import { createTransport } from './config.js'
import { createTransportError } from './error-fabs-logger.js'

/**
 * Зависимости модуля для тестирования
 */
export const dependencies = {
  env: process.env,
  pino,
  baseLogger: null, // Логгер для тестирования
  createTransport, // Из config.js
  Date // Добавляем Date для тестирования
}

/**
 * Устанавливает зависимости модуля для тестирования
 *
 * @param {Partial<typeof dependencies>} newDependencies - Новые зависимости
 */
export function setDependencies (newDependencies) {
  Object.assign(dependencies, newDependencies)
}

/**
 * Получает строковый уровень логирования по числовому значению
 *
 * @param {number} level - Числовой уровень логирования
 * @returns {string} Строковый уровень логирования
 * @private
 */
function getLevelName (level) {
  const levels = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal'
  }
  return levels[level] || 'info'
}

/**
 * Подготавливает значение для логирования с учетом типа данных и настроек
 *
 * Основная ответственность:
 * - Преобразование Map в обычные объекты для корректного логирования
 * - Ограничение глубины вложенности для Map структур
 * - Ограничение длины строковых значений
 * - Корректная обработка различных типов данных
 *
 * Особенности реализации:
 * - Для Map структур применяется ограничение глубины вложенности
 * - Для строковых значений применяется ограничение длины, если включено
 * - Обычные объекты обрабатываются рекурсивно без ограничения глубины
 * - Ошибки и специальные типы сохраняются без изменений
 *
 * @param {*} value - Значение для преобразования
 * @param {number} depth - Максимальная глубина рекурсии (только для Map структур)
 * @param {number} maxStringLength - Максимальная длина строк (0 - без ограничений)
 * @param {string} truncationMarker - Маркер обрезки для длинных строк
 * @returns {*} Преобразованное значение
 * @private
 */
function prepareValueForLogging (value, depth = 8, maxStringLength = 0, truncationMarker = '...') {
  // Обработка строковых значений
  if (typeof value === 'string' && maxStringLength > 0 && value.length > maxStringLength) {
    return value.substring(0, maxStringLength) + truncationMarker;
  }

  // Для Map структур
  if (value instanceof Map) {
    // Проверка глубины для Map структур согласно ожиданиям тестов
    if (depth <= 0) {
      return '[Max Map Depth Reached]'
    }

    const obj = {}
    for (const [k, v] of value.entries()) {
      // Для Map всегда уменьшаем глубину на 1 при рекурсии
      obj[String(k)] = prepareValueForLogging(v, depth - 1, maxStringLength, truncationMarker)
    }
    return obj
  }

  // Для массивов
  if (Array.isArray(value)) {
    // Для элементов массива передаем текущую глубину без изменений
    return value.map(item => prepareValueForLogging(item, depth, maxStringLength, truncationMarker))
  }

  // Для обычных объектов - всегда обрабатываем без ограничений глубины
  if (value && typeof value === 'object' && !(value instanceof Error)) {
    const result = {}
    for (const [k, v] of Object.entries(value)) {
      // Не меняем глубину для обычных объектов, всегда передаем текущую глубину
      result[k] = prepareValueForLogging(v, depth, maxStringLength, truncationMarker)
    }
    return result
  }

  // Примитивы и другие типы данных возвращаем без изменений
  return value
}

/**
 * Создает базовый pino логгер
 *
 * ВАЖНО: Эта функция вызывается только один раз при первой инициализации.
 *
 * @param {Object} env - Переменные окружения
 * @returns {pino.Logger} Базовый pino логгер
 * @throws {SystemError} При ошибке инициализации
 * @private
 */
function initializeBaseLogger (env) {
  try {
    const { pino, createTransport } = dependencies
    const transport = createTransport(env)

    // Определяем базовые опции
    const options = {
      timestamp: true
    }

    // Устанавливаем уровень логирования
    if (transport.level) {
      const levelName = getLevelName(transport.level)
      options.level = levelName
    }

    // Создаем логгер
    let logger

    // Если у нас новый формат транспорта через worker threads
    if (transport.transport && typeof transport.transport.pipe !== 'function') {
      logger = pino(options, transport.transport)
    } else {
      // Старый формат с multistream
      logger = pino(options, transport.transport)
    }

    // Проверяем, что уровень установлен правильно
    const levelName = getLevelName(transport.level)
    if (!logger[levelName]) {
      throw new Error(`Logger initialization failed - invalid level: ${levelName}`)
    }

    dependencies.baseLogger = logger
    return logger
  } catch (error) {
    throw createTransportError('Failed to initialize base logger', error)
  }
}

/**
 * Проверяет соответствие namespace паттерну
 *
 * @param {string} namespace - Проверяемый namespace
 * @param {string} pattern - Паттерн для проверки
 * @returns {boolean} true если namespace соответствует паттерну
 * @private
 */
function patternMatches (namespace, pattern) {
  const regex = pattern
    .replace(/^-/, '')
    .replace(/[.:]/g, '\\$&') // Экранируем и точку и двоеточие
    .replace(/\*/g, '.*')
  // Убираем $ в конце для поддержки вложенных namespace
  return new RegExp(`^${regex}`).test(namespace)
}

/**
 * Оборачивает метод логгера для поддержки всех вариантов вызова
 *
 * Основная ответственность:
 * - Обработка разных форматов входных аргументов
 * - Преобразование Map в объекты для корректного логирования
 * - Ограничение длины строковых значений
 * - Корректная передача аргументов в pino
 * - Специальная обработка объектов Error
 * - Сохранение контекста лога
 *
 * @param {pino.Logger} logger - Экземпляр логгера pino
 * @param {string} method - Имя метода логгера
 * @returns {Function} Обертка над методом логгера
 * @private
 */
function wrapLogMethod (logger, method) {
  return function (...args) {
    if (args.length === 0) return

    // Получаем настройки из окружения
    const maxDepth = parseInt(dependencies.env.LOG_MAX_DEPTH, 10) || 8
    const maxStringLength = parseInt(dependencies.env.LOG_MAX_STRING_LENGTH, 10) || 0
    const truncationMarker = dependencies.env.LOG_TRUNCATION_MARKER || '...'

    const firstArg = args[0]

    // Преобразуем все аргументы, которые являются объектами
    const convertedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return { err: arg }
      }
      if (typeof arg === 'object' && arg !== null) {
        return prepareValueForLogging(arg, maxDepth, maxStringLength, truncationMarker)
      }
      // Обработка строк в качестве прямых аргументов
      if (typeof arg === 'string' && maxStringLength > 0 && arg.length > maxStringLength) {
        return arg.substring(0, maxStringLength) + truncationMarker
      }
      return arg
    })

    // Если первый аргумент был Error
    if (firstArg instanceof Error) {
      return logger[method](convertedArgs[0])
    }

    // Если первый аргумент это объект (но не Error и не строка)
    if (typeof firstArg === 'object' && firstArg !== null) {
      // Если в объекте есть Error, обрабатываем его специально
      if (firstArg.err instanceof Error) {
        const { err, ...rest } = convertedArgs[0]
        return logger[method]({
          ...rest,
          err: {
            message: firstArg.err.message,
            stack: firstArg.err.stack,
            type: firstArg.err.constructor.name,
            code: firstArg.err.code
          }
        }, ...convertedArgs.slice(1))
      }
      // Передаем преобразованный объект и остальные аргументы
      return logger[method](...convertedArgs)
    }

    // Для остальных случаев (строка с плейсхолдерами или просто строка)
    return logger[method](undefined, ...convertedArgs)
  }
}

/**
 * Создает обертку над pino логгером с фильтрацией по namespace
 *
 * Основная ответственность:
 * - Создание и переиспользование единого базового логгера
 * - Фильтрация сообщений по namespace через механизм DEBUG
 * - Поддержка всех вариантов вызова методов pino
 * - Специальная обработка Error объектов
 * - Поддержка форматирования сообщений через плейсхолдеры
 *
 * Плейсхолдеры для форматирования:
 * - %s - строки
 * - %d - числа
 * - %j - JSON и объекты
 * - %% - символ %
 *
 * @param {string} namespace - Namespace для фильтрации
 * @returns {Object} Объект с методами логирования
 * @throws {SystemError} При ошибке инициализации транспорта
 */
export function createLogger (namespace = undefined) {
  try {
    // Берем/создаем базовый логгер
    const baseLogger = dependencies.baseLogger || initializeBaseLogger(dependencies.env)

    // Создаем дочерний логгер с namespace
    const child = namespace ? baseLogger.child({ namespace }) : baseLogger

    // Фильтр по namespace через DEBUG
    const nsFilter = !namespace?.trim() ? null : () => {
      const debug = dependencies.env.DEBUG?.trim()
      if (!debug) return false // Блокируем все при пустом DEBUG

      const patterns = debug.split(',').map(p => p.trim())
      let enabled = patterns.includes('*')
      for (const pattern of patterns) {
        if (patternMatches(namespace, pattern)) {
          enabled = !pattern.startsWith('-')
        }
      }
      return enabled
    }

    // Создаем методы с фильтрацией
    return LOG_LEVELS.reduce((acc, level) => {
      // Создаем обертку один раз для каждого уровня
      const wrappedMethod = wrapLogMethod(child, level)
      acc[level] = (...args) => {
        if (nsFilter && !nsFilter()) return
        return wrappedMethod(...args)
      }
      return acc
    }, {})
  } catch (error) {
    // Не оборачиваем повторно ошибку из initializeBaseLogger
    // Просто пробрасываем её дальше, сохраняя исходное сообщение и цепочку
    throw error
  }
}

/**
 * Поддерживаемые уровни логирования
 * @type {string[]}
 */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
