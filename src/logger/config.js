/**
 * @file src/logger/config.js
 * @description Модуль конфигурации логгера - загрузка настроек и создание транспортов
 * @version 0.6.2
 *
 * Поддерживаются следующие переменные окружения:
 * - LOG_LEVEL - уровень логирования (trace, debug, info, warn, error, fatal)
 * - LOG_COLORIZE - цветной вывод в консоль (true/false)
 * - LOG_FILE_OUTPUT - запись в файл (true/false)
 * - LOG_CONSOLE_OUTPUT - вывод в консоль (true/false)
 * - LOG_FOLDER - папка для лог файлов
 * - LOG_SYNC - синхронная запись (true/false)
 * - LOG_PRETTY - форматированный вывод (true/false)
 *
 * Поддержка множественных транспортов:
 * - TRANSPORT{N} - тип транспорта (console, file)
 * - TRANSPORT{N}_LEVEL - уровень логирования для транспорта
 * - Специфичные настройки для разных типов транспортов
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import pino from 'pino'
import pretty from 'pino-pretty'

import { createLogDirError, createTransportError } from './error-fabs-logger.js'

const DEFAULT_APP_NAME = 'app'

// Маппинг уровней логирования в числовые значения pino
const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
}

/**
 * Зависимости модуля
 */
export const dependencies = {
  pino,
  pretty,
  fs,
  path,
  env: process.env
}

/**
 * Устанавливает зависимости модуля
 * @param {Partial<typeof dependencies>} newDependencies - Новые зависимости
 */
export function setDependencies (newDependencies) {
  Object.assign(dependencies, newDependencies)
}

/**
 * Загружает имя и версию приложения из package.json
 *
 * При отсутствии файла или поля name возвращает значения по умолчанию.
 *
 * @returns {Object} Объект с именем и версией приложения
 * @private
 */
function loadAppInfo () {
  const { fs, path } = dependencies
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const packagePath = path.join(__dirname, '../../package.json')
    const packageContent = fs.readFileSync(packagePath, 'utf-8')
    const { name, version } = JSON.parse(packageContent)
    return {
      name: name || DEFAULT_APP_NAME,
      version: version || '1.0.0'
    }
  } catch (error) {
    return {
      name: DEFAULT_APP_NAME,
      version: '1.0.0'
    }
  }
}

/**
 * Обрабатывает шаблоны в имени файла, заменяя их фактическими значениями
 *
 * Поддерживаемые шаблоны:
 * - {date} - текущая дата (YYYY-MM-DD)
 * - {time} - текущее время (HH-mm-ss)
 * - {datetime} - комбинация даты и времени (YYYY-MM-DD_HH-mm-ss)
 * - {app_name} - имя приложения из package.json
 * - {app_version} - версия приложения из package.json
 * - {pid} - ID процесса
 * - {hostname} - имя хоста
 *
 * @param {string} template - Шаблон имени файла
 * @returns {string} Обработанное имя файла
 */
export function processFilenameTemplate (template) {
  if (!template) return 'app.log'

  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const timeStr = now.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0]
  const datetimeStr = `${dateStr}_${timeStr}`

  const appInfo = loadAppInfo()

  return template
    .replace(/{date}/g, dateStr)
    .replace(/{time}/g, timeStr)
    .replace(/{datetime}/g, datetimeStr)
    .replace(/{app_name}/g, appInfo.name)
    .replace(/{app_version}/g, appInfo.version)
    .replace(/{pid}/g, process.pid)
    .replace(/{hostname}/g, os.hostname())
}

/**
 * Создает директорию для логов если она не существует
 *
 * @param {string} logFolder - Путь к директории логов
 * @throws {SystemError} LOG_DIR_CREATE_FAILED при ошибке создания директории
 * @private
 */
function ensureLogDirectory (logFolder) {
  const { fs } = dependencies
  try {
    if (!fs.existsSync(logFolder)) {
      fs.mkdirSync(logFolder, { recursive: true })
    }
  } catch (error) {
    throw createLogDirError(logFolder, error.message, error)
  }
}

/**
 * Преобразует строковый уровень логирования в числовой для pino
 *
 * @param {string} level - Строковый уровень логирования
 * @returns {number} Числовой уровень для pino или уровень info при некорректном входном значении
 * @private
 */
function getLevelValue (level) {
  const normalized = level?.toLowerCase()
  return LOG_LEVELS[normalized] || LOG_LEVELS.info
}

/**
 * Парсит настройки множественных транспортов из переменных окружения
 *
 * Ищет и обрабатывает переменные в формате TRANSPORT{N}, TRANSPORT{N}_*
 * где N - порядковый номер транспорта, начиная с 1.
 *
 * @param {Object} env - Переменные окружения
 * @returns {Array} Массив конфигураций транспортов
 * @private
 */
function parseTransportConfigs (env) {
  const transportConfigs = []

  // Ищем переменные TRANSPORT1, TRANSPORT2, ...
  let transportIndex = 1
  while (env[`TRANSPORT${transportIndex}`]) {
    const prefix = `TRANSPORT${transportIndex}_`
    const type = env[`TRANSPORT${transportIndex}`].toLowerCase()

    const config = {
      type,
      level: env[`${prefix}LEVEL`] || 'info',
      enabled: env[`${prefix}ENABLED`] !== 'false',
      sync: env[`${prefix}SYNC`] === 'true'
    }

    // Специфичные настройки для консольного транспорта
    if (type === 'console') {
      config.colors = env[`${prefix}COLORS`] !== 'false'
      config.translateTime = env[`${prefix}TRANSLATE_TIME`] || 'SYS:standard'
      config.ignore = env[`${prefix}IGNORE`] || 'pid,hostname'
      config.singleLine = env[`${prefix}SINGLE_LINE`] === 'true'
      config.hideObjectKeys = env[`${prefix}HIDE_OBJECT_KEYS`] || ''
      config.showMetadata = env[`${prefix}SHOW_METADATA`] === 'true'
    }
    // Специфичные настройки для файлового транспорта
    else if (type === 'file') {
      config.folder = env[`${prefix}FOLDER`] || 'logs'
      config.filename = env[`${prefix}FILENAME`] || '{app_name}.log'
      config.destination = env[`${prefix}DESTINATION`] || ''
      config.mkdir = env[`${prefix}MKDIR`] !== 'false'
      config.append = env[`${prefix}APPEND`] !== 'false'
      config.prettyPrint = env[`${prefix}PRETTY_PRINT`] === 'true'

      // Настройки ротации
      config.rotate = env[`${prefix}ROTATE`] === 'true'
      config.rotateMaxSize = parseInt(env[`${prefix}ROTATE_MAX_SIZE`], 10) || 10485760 // 10MB
      config.rotateMaxFiles = parseInt(env[`${prefix}ROTATE_MAX_FILES`], 10) || 5
      config.rotateCompress = env[`${prefix}ROTATE_COMPRESS`] === 'true'
    }

    // Общие настройки форматирования
    config.timestamp = env[`${prefix}TIMESTAMP`] !== 'false'
    config.messageKey = env[`${prefix}MESSAGE_KEY`] || 'msg'
    config.timestampKey = env[`${prefix}TIMESTAMP_KEY`] || 'time'
    config.levelKey = env[`${prefix}LEVEL_KEY`] || 'level'

    transportConfigs.push(config)
    transportIndex++
  }

  return transportConfigs
}

/**
 * Создает транспорты Pino на основе конфигурации
 *
 * @param {Array} transportConfigs - Массив конфигураций транспортов
 * @returns {Object} Объект транспорта Pino
 * @private
 */
function createPinoTransports (transportConfigs) {
  const { pino, path } = dependencies

  // Фильтруем отключенные транспорты
  const enabledTransports = transportConfigs.filter(t => t.enabled)

  if (enabledTransports.length === 0) {
    // Если нет транспортов, создаем дефолтный консольный
    return {
      level: LOG_LEVELS.info,
      transport: pino.transport({
        targets: [{
          level: 'info', // Добавлен уровень логирования для соответствия ожиданиям теста
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }]
      })
    }
  }

  // Преобразуем в формат для pino.transport
  const targets = enabledTransports.map(config => {
    if (config.type === 'console') {
      return {
        level: config.level,
        target: 'pino-pretty',
        options: {
          colorize: config.colors,
          translateTime: config.translateTime,
          ignore: config.ignore,
          singleLine: config.singleLine,
          // hideObject: config.hideObjectKeys.split(',').filter(k => k),
          // messageKey: config.messageKey,
          // levelKey: config.levelKey,
          timestampKey: config.timestampKey
        }
      }
    } else if (config.type === 'file') {
      // Обрабатываем шаблоны в имени файла
      const processedFilename = processFilenameTemplate(config.filename)

      // Определяем назначение
      let destination
      if (config.destination) {
        // Если указан числовой дескриптор (1=stdout, 2=stderr)
        if (/^\d+$/.test(config.destination)) {
          destination = parseInt(config.destination, 10)
        } else {
          destination = config.destination
        }
      } else {
        // Если не указан, формируем полный путь
        ensureLogDirectory(config.folder)
        destination = path.join(config.folder, processedFilename)
      }

      return {
        level: config.level,
        target: 'pino/file',
        options: {
          destination,
          mkdir: config.mkdir,
          append: config.append,
          sync: config.sync
        }
      }
    }
    return null
  }).filter(Boolean)
  // Создаем транспорт через pino.transport
  const transportOptions = {
    targets,
    dedupe: false // Позволяем логам идти во все транспорты согласно их уровням
  }

  try {
    return {
      level: Math.min(...targets.map(t => getLevelValue(t.level))), // Минимальный уровень из всех транспортов
      transport: pino.transport(transportOptions)
    }
  } catch (error) {
    throw createTransportError(`Failed to create pino transports: ${error.message}`, error)
  }
}

/**
 * Создает транспорты на основе старого формата настроек
 *
 * Используется для обратной совместимости с существующими параметрами:
 * - LOG_LEVEL, LOG_COLORIZE, LOG_FILE_OUTPUT, LOG_CONSOLE_OUTPUT, LOG_FOLDER, etc.
 *
 * @param {Object} config - Конфигурация из loadConfig
 * @returns {Array} Массив конфигураций транспортов
 * @private
 */
function createLegacyTransports (config) {
  const transports = []

  // Консольный транспорт
  if (config.consoleOutput) {
    transports.push({
      type: 'console',
      level: config.logLevel,
      colors: config.colorize,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      sync: config.sync,
      pretty: config.pretty,
      enabled: true
    })
  }

  // Файловый транспорт
  if (config.fileOutput) {
    transports.push({
      type: 'file',
      level: config.logLevel,
      folder: config.logFolder,
      filename: '{app_name}.log',
      mkdir: true,
      append: true,
      sync: config.sync,
      enabled: true
    })
  }

  // Если оба транспорта отключены, создаем дефолтный консольный
  if (transports.length === 0) {
    transports.push({
      type: 'console',
      level: config.logLevel,
      colors: config.colorize,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      sync: config.sync,
      pretty: config.pretty,
      enabled: true
    })
  }

  return transports
}

/**
 * Загружает конфигурацию логгера из переменных окружения
 *
 * Основная ответственность:
 * - Загрузка настроек из env переменных
 * - Применение значений по умолчанию
 * - Валидация значений
 *
 * Значения по умолчанию:
 * - logLevel: 'info'
 * - colorize: true
 * - fileOutput: true
 * - consoleOutput: true
 * - logFolder: 'logs'
 * - sync: false
 * - pretty: false
 *
 * @param {Object} env - Переменные окружения
 * @returns {Object} Конфигурация логгера с настройками транспортов и форматирования
 */
export function loadConfig (env) {
  const config = {
    // Базовые настройки (для обратной совместимости)
    logLevel: env.LOG_LEVEL || 'info',
    colorize: env.LOG_COLORIZE !== 'false',
    fileOutput: env.LOG_FILE_OUTPUT !== 'false',
    consoleOutput: env.LOG_CONSOLE_OUTPUT !== 'false',
    logFolder: env.LOG_FOLDER || 'logs',
    sync: env.LOG_SYNC === 'true',
    pretty: env.LOG_PRETTY === 'true',

    // Загружаем настройки множественных транспортов
    transportConfigs: parseTransportConfigs(env)
  }

  return config
}

/**
 * Создает конфигурацию транспорта для pino
 *
 * Основная ответственность:
 * - Настройка целевых транспортов (файл и консоль)
 * - Конфигурация форматирования через pino-pretty
 * - Управление синхронностью записи
 * - Преобразование уровней логирования
 *
 * Поддерживаются транспорты:
 * 1. Множественные транспорты через TRANSPORT1, TRANSPORT2, etc.
 *    - Различные типы (console, file)
 *    - Индивидуальные уровни и настройки
 *    - Применяется если найдено хотя бы одно определение TRANSPORT{N}
 *
 * 2. Обратная совместимость
 *    - Файловый - через pino.destination (LOG_FILE_OUTPUT)
 *    - Консольный - через pino-pretty (LOG_CONSOLE_OUTPUT)
 *    - Папка задается через LOG_FOLDER
 *    - В тестах всегда синхронный
 *
 * @param {Object} env - Переменные окружения
 * @returns {Object} Конфигурация транспорта для pino
 * @throws {SystemError} LOG_TRANSPORT_INIT_FAILED при любых ошибках инициализации,
 *         включая LOG_DIR_CREATE_FAILED в originalError при проблемах с директорией
 */
export function createTransport (env) {
  try {
    const { pino, pretty } = dependencies
    const config = loadConfig(env)

    // Используем новый формат транспортов, если они определены
    if (config.transportConfigs && config.transportConfigs.length > 0) {
      return createPinoTransports(config.transportConfigs)
    }

    // Иначе используем старый формат (обратная совместимость)
    const appName = loadAppInfo().name
    const numericLevel = getLevelValue(config.logLevel)

    // Формируем набор транспортов
    const streams = []

    // Файловый транспорт если включен
    if (config.fileOutput) {
      // Проверяем папку
      ensureLogDirectory(config.logFolder)
      const logFile = path.join(config.logFolder, `${appName}.log`)

      // Файловый транспорт всегда синхронный в тестах
      streams.push({
        level: numericLevel,
        stream: pino.destination({
          dest: logFile,
          sync: true, // В тестах всегда синхронно
          mkdir: true
        })
      })
    }

    // Консольный транспорт если включен
    if (config.consoleOutput) {
      const prettyOptions = {
        colorize: config.colorize,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        sync: true // В тестах всегда синхронно
      }

      // Всегда используем pino-pretty для форматированного вывода в консоль
      streams.push({
        level: numericLevel,
        stream: pretty(prettyOptions)
      })
    }

    // Проверяем что есть хотя бы один транспорт
    if (streams.length === 0) {
      // По умолчанию выводим в stdout через pino-pretty
      const prettyOptions = {
        colorize: config.colorize,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        sync: true
      }
      streams.push({
        level: numericLevel,
        stream: pretty(prettyOptions)
      })
    }

    // Создаем мультиплексный транспорт
    const transport = pino.multistream(streams)

    return {
      level: numericLevel,
      transport
    }
  } catch (error) {
    throw createTransportError(error.message, error)
  }
}
