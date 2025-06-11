/**
 * @file src/logger/config.js
 * @description Модуль конфигурации логгера - загрузка настроек и создание транспортов
 * @version 0.8.0
 *
 * @changelog
 * - 0.8.0 (2025-06-11): Финальное исправление ошибки в `createPinoTransports`, из-за которой файловый транспорт некорректно
 *                      обрабатывался как `pino-pretty`. Упрощена логика выбора таргета. Удален отладочный вывод.
 * - 0.7.3 (2025-06-11): Добавлен временный отладочный вывод для диагностики.
 * - 0.7.2 (2025-06-11): Рефакторинг `parseTransportConfigs`.
 * - 0.7.1 (2025-06-11): Неудачная попытка исправления.
 * - 0.7.0 (2025-06-11): Добавлена отказоустойчивость и поддержка `prettyPrint`.
 *
 * @description
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
 * Проверяет доступность директории для записи и создает её, если нужно.
 * В случае ошибки выводит сообщение в console.error и возвращает false.
 * @param {string} logFolder - Путь к директории логов
 * @returns {boolean} - true в случае успеха, false в случае ошибки
 * @private
 */
function verifyLogDirectory (logFolder) {
  const { fs } = dependencies
  try {
    // Проверяем, существует ли директория
    if (!fs.existsSync(logFolder)) {
      // Если нет, пытаемся создать
      fs.mkdirSync(logFolder, { recursive: true })
    }
    // Проверяем права на запись (может выбросить исключение)
    fs.accessSync(logFolder, fs.constants.W_OK)
    return true
  } catch (error) {
    // Используем console.error, так как логгер еще не готов
    console.error(
      `[SYS_LOGGER FATAL] Failed to access or create log directory: ${logFolder}.` +
      `\n       Reason: ${error.message}` +
      `\n       The file transport for this directory will be disabled.`
    )
    return false
  }
}

/**
 * Создает директорию для логов если она не существует (для старого API)
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
 * Парсит настройки множественных транспортов из переменных окружения.
 * Эта функция строго разделяет парсинг опций по типам транспортов.
 *
 * @param {Object} env - Переменные окружения
 * @returns {Array} Массив конфигураций транспортов
 * @private
 */
function parseTransportConfigs (env) {
  const transportConfigs = []
  let transportIndex = 1

  while (env[`TRANSPORT${transportIndex}`]) {
    const prefix = `TRANSPORT${transportIndex}_`
    const type = env[`TRANSPORT${transportIndex}`].toLowerCase()

    // 1. Создаем базовый объект с действительно общими полями
    const config = {
      type,
      level: env[`${prefix}LEVEL`] || 'info',
      enabled: env[`${prefix}ENABLED`] !== 'false',
      sync: env[`${prefix}SYNC`] === 'true'
    }

    // 2. Добавляем опции строго в зависимости от типа транспорта
    if (type === 'console') {
      Object.assign(config, {
        colors: env[`${prefix}COLORS`] !== 'false',
        translateTime: env[`${prefix}TRANSLATE_TIME`] || 'SYS:standard',
        ignore: env[`${prefix}IGNORE`] || 'pid,hostname',
        singleLine: env[`${prefix}SINGLE_LINE`] === 'true',
        hideObjectKeys: env[`${prefix}HIDE_OBJECT_KEYS`] || '',
        showMetadata: env[`${prefix}SHOW_METADATA`] === 'true',
        timestampKey: env[`${prefix}TIMESTAMP_KEY`] || 'time'
      })
    } else if (type === 'file') {
      Object.assign(config, {
        folder: env[`${prefix}FOLDER`] || 'logs',
        filename: env[`${prefix}FILENAME`] || '{app_name}.log',
        destination: env[`${prefix}DESTINATION`] || '',
        mkdir: env[`${prefix}MKDIR`] !== 'false',
        append: env[`${prefix}APPEND`] !== 'false',
        prettyPrint: env[`${prefix}PRETTY_PRINT`] === 'true',
        // Опции ротации
        rotate: env[`${prefix}ROTATE`] === 'true',
        rotateMaxSize: parseInt(env[`${prefix}ROTATE_MAX_SIZE`], 10) || 10485760, // 10MB
        rotateMaxFiles: parseInt(env[`${prefix}ROTATE_MAX_FILES`], 10) || 5,
        rotateCompress: env[`${prefix}ROTATE_COMPRESS`] === 'true'
      })
    }

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

  const enabledTransports = transportConfigs.filter(t => t.enabled)

  const targets = enabledTransports
    .map(config => {
      if (config.type === 'console') {
        return {
          level: config.level,
          target: 'pino-pretty',
          options: {
            colorize: config.colors,
            translateTime: config.translateTime,
            ignore: config.ignore,
            singleLine: config.singleLine,
            timestampKey: config.timestampKey
          }
        }
      }

      if (config.type === 'file') {
        let destination
        if (config.destination && /^\d+$/.test(config.destination)) {
          destination = parseInt(config.destination, 10)
        } else if (config.destination) {
          const dir = path.dirname(config.destination)
          if (!verifyLogDirectory(dir)) return null
          destination = config.destination
        } else {
          if (!verifyLogDirectory(config.folder)) return null
          const processedFilename = processFilenameTemplate(config.filename)
          destination = path.join(config.folder, processedFilename)
        }

        if (config.prettyPrint) {
          // Ветка ДА: используем pino-pretty
          return {
            level: config.level,
            target: 'pino-pretty',
            options: {
              destination,
              colorize: true, // Разумный дефолт для вывода в консоль
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              sync: config.sync
            }
          }
        } else {
          // Ветка НЕТ: используем стандартный pino/file
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
      }

      return null // Для любых других будущих типов
    })
    .filter(Boolean)

  if (targets.length === 0) {
    console.error(
      '[SYS_LOGGER WARNING] All configured transports failed to initialize. ' +
      'Falling back to a default console logger (level: info).'
    )
    return {
      level: LOG_LEVELS.info,
      transport: pino.transport({
        targets: [{
          level: 'info',
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }]
      })
    }
  }

  const transportOptions = {
    targets,
    dedupe: false
  }

  try {
    return {
      level: Math.min(...targets.map(t => getLevelValue(t.level))),
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
 * @param {Object} env - Переменные окружения
 * @returns {Object} Конфигурация транспорта для pino
 * @throws {SystemError} LOG_TRANSPORT_INIT_FAILED при любых ошибках инициализации,
 *         включая LOG_DIR_CREATE_FAILED в originalError при проблемах с директорией
 */
export function createTransport (env) {
  try {
    const { pino, pretty } = dependencies
    const config = loadConfig(env)

    if (config.transportConfigs && config.transportConfigs.length > 0) {
      return createPinoTransports(config.transportConfigs)
    }

    const appName = loadAppInfo().name
    const numericLevel = getLevelValue(config.logLevel)
    const streams = []

    if (config.fileOutput) {
      ensureLogDirectory(config.logFolder)
      const logFile = path.join(config.logFolder, `${appName}.log`)
      streams.push({
        level: numericLevel,
        stream: pino.destination({ dest: logFile, sync: true, mkdir: true })
      })
    }

    if (config.consoleOutput) {
      const prettyOptions = {
        colorize: config.colorize,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        sync: true
      }
      streams.push({ level: numericLevel, stream: pretty(prettyOptions) })
    }

    if (streams.length === 0) {
      const prettyOptions = {
        colorize: config.colorize,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        sync: true
      }
      streams.push({ level: numericLevel, stream: pretty(prettyOptions) })
    }

    const transport = pino.multistream(streams)
    return { level: numericLevel, transport }
  } catch (error) {
    throw createTransportError(error.message, error)
  }
}
