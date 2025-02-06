/**
 * @file src/logger/config.js
 * @description Модуль конфигурации логгера - загрузка настроек и создание конфигурации pino
 * @version 0.5.3
 *
 * Поддерживаются следующие переменные окружения:
 * - LOG_LEVEL - уровень логирования (trace, debug, info, warn, error, fatal)
 * - LOG_COLORIZE - цветной вывод в консоль (true/false)
 * - LOG_FILE_OUTPUT - запись в файл (true/false)
 * - LOG_CONSOLE_OUTPUT - вывод в консоль (true/false)
 * - LOG_FOLDER - папка для лог файлов
 * - LOG_SYNC - синхронная запись (true/false)
 * - LOG_PRETTY - форматированный вывод (true/false)
 */

import fs from 'fs'
import path from 'path'
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
 * Загружает имя приложения из package.json
 *
 * При отсутствии файла или поля name возвращает значение по умолчанию.
 *
 * @returns {string} Имя приложения или значение по умолчанию
 * @private
 */
function loadAppName () {
  const { fs, path } = dependencies
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const packagePath = path.join(__dirname, '../../package.json')
    const packageContent = fs.readFileSync(packagePath, 'utf-8')
    const { name } = JSON.parse(packageContent)
    return name || DEFAULT_APP_NAME
  } catch (error) {
    return DEFAULT_APP_NAME
  }
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
  return {
    logLevel: env.LOG_LEVEL || 'info',
    colorize: env.LOG_COLORIZE !== 'false',
    fileOutput: env.LOG_FILE_OUTPUT !== 'false',
    consoleOutput: env.LOG_CONSOLE_OUTPUT !== 'false',
    logFolder: env.LOG_FOLDER || 'logs',
    sync: env.LOG_SYNC === 'true',
    pretty: env.LOG_PRETTY === 'true'
  }
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
 * 1. Файловый - через pino.destination
 *    - Настраивается через LOG_FILE_OUTPUT
 *    - Папка задается через LOG_FOLDER
 *    - В тестах всегда синхронный
 *
 * 2. Консольный - через pino-pretty
 *    - Настраивается через LOG_CONSOLE_OUTPUT
 *    - Поддерживает цветной вывод (LOG_COLORIZE)
 *    - Форматированный вывод через LOG_PRETTY
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

    const appName = loadAppName()
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
          sync: true,  // В тестах всегда синхронно
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
        sync: true  // В тестах всегда синхронно
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
