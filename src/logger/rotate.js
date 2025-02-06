/**
 * @file src/logger/rotate.js
 * @description Модуль управления ротацией и архивированием лог файлов
 * @version 0.1.2
 */

import fs from 'fs'
import path from 'path'
import { createLogger } from './logger.js'
import { createCleanupError, createRotateError } from './error-fabs-logger.js'

const logger = createLogger('logger:rotate')

/**
 * @typedef {Object} RotateConfig
 * @property {string} logFolder - Папка для логов
 * @property {number} maxSize - Максимальный размер файла в байтах
 * @property {number} maxFiles - Максимальное количество архивных файлов
 * @property {boolean} compress - Сжимать архивные файлы
 */

/**
 * Зависимости модуля
 */
export const dependencies = {
  fs,
  path,
  env: process.env,
  logger
}

/**
 * Устанавливает зависимости модуля
 * @param {Partial<typeof dependencies>} newDependencies - Новые зависимости
 */
export function setDependencies (newDependencies) {
  Object.assign(dependencies, newDependencies)
}

/**
 * Проверяет необходимость ротации и выполняет её
 *
 * Основная ответственность:
 * - Проверка текущего размера файла
 * - Создание архивных копий при превышении лимита
 * - Очистка старых архивов
 *
 * @param {string} filePath - Путь к файлу лога
 * @param {RotateConfig} config - Конфигурация ротации
 * @returns {Promise<boolean>} true если была выполнена ротация
 */
export async function checkAndRotate (filePath, config) {
  const { fs } = dependencies

  try {
    if (!fs.existsSync(filePath)) {
      return false
    }

    const stats = fs.statSync(filePath)
    if (stats.size < config.maxSize) {
      return false
    }

    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')
    const archivePath = `${filePath}.${timestamp}`

    await fs.promises.rename(filePath, archivePath)
    await fs.promises.writeFile(filePath, '')

    await cleanupOldArchives(config.logFolder, config)

    return true
  } catch (error) {
    throw createRotateError(filePath, error.message, error)
  }
}

/**
 * Архивирует тестовые логи
 *
 * Основная ответственность:
 * - Проверка существования и содержимого тестового лога
 * - Добавление логов в архивный файл с меткой времени
 * - Контроль размера архива
 *
 * @param {string} testFile - Путь к файлу текущих тестовых логов
 * @param {string} archiveFile - Путь к архивному файлу
 * @returns {Promise<void>}
 */
export async function archiveTestLogs (testFile, archiveFile) {
  const { fs } = dependencies

  try {
    if (!fs.existsSync(testFile)) {
      return
    }

    let testContent
    try {
      testContent = await fs.promises.readFile(testFile, 'utf-8')
    } catch (error) {
      throw createRotateError(testFile, error.message, error)
    }

    if (!testContent || !testContent.trim()) {
      return
    }

    const timestamp = new Date().toISOString()
    const separator = `\n\n========== Test Run: ${timestamp} ==========\n\n`

    await fs.promises.appendFile(archiveFile, separator + testContent)

    // Проверяем необходимость ротации архива
    const maxSize = parseInt(dependencies.env.LOG_MAX_SIZE, 10) || (10 * 1024 * 1024)
    await checkAndRotate(archiveFile, {
      logFolder: path.dirname(archiveFile),
      maxSize,
      maxFiles: 5,
      compress: false
    })
  } catch (error) {
    throw createRotateError(archiveFile, error.message, error)
  }
}

/**
 * Очищает старые архивные файлы
 *
 * Основная ответственность:
 * - Поиск архивных файлов в папке
 * - Сортировка по дате создания
 * - Удаление старых архивов сверх лимита
 *
 * @param {string} logFolder - Папка с логами
 * @param {RotateConfig} config - Конфигурация ротации
 * @returns {Promise<string[]>} Пути удаленных файлов
 */
export async function cleanupOldArchives (logFolder, config) {
  const { fs, path } = dependencies

  try {
    const files = await fs.promises.readdir(logFolder)

    const archives = files
      .filter(file => /\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*Z$/.test(file))
      .map(file => ({
        name: file,
        path: path.join(logFolder, file),
        timestamp: new Date(file.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*Z/)[0].replace(/-/g, ':'))
      }))
      .sort((a, b) => b.timestamp - a.timestamp)

    const deleted = []
    if (archives.length > config.maxFiles) {
      const toDelete = archives.slice(config.maxFiles)
      for (const archive of toDelete) {
        await fs.promises.unlink(archive.path)
        deleted.push(archive.path)
      }
    }

    return deleted
  } catch (error) {
    throw createCleanupError(error.message, error)
  }
}
