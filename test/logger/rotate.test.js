/**
 * @file test/logger/rotate.test.js
 * @version 0.3.2
 * @description Тесты модуля ротации и архивирования лог файлов
 * @tested-file src/logger/rotate.js
 * @tested-file-version 0.1.2
 * @test-doc docs/tests/TESTS_SYS_LOGGER, v0.3.0.md
 */

import { expect, vi, describe, beforeEach, afterEach, test } from 'vitest'
import path from 'path'
import { fileURLToPath } from 'url'
import { SystemError } from '@fab33/sys-errors'

import { LOGGER_ERROR_CODES } from '../../src/logger/errors-logger.js'
import { createLogger } from '../../src/logger/logger.js'
import {
  checkAndRotate,
  cleanupOldArchives,
  dependencies as rotateDeps,
  setDependencies
} from '../../src/logger/rotate.js'

// Используем реальный логгер для отладки тестов
const logger = createLogger('test:logger:rotate')

describe('(rotate.js) Модуль ротации и архивирования лог файлов', () => {
  // Сохраняем оригинальные зависимости
  const origDeps = { ...rotateDeps }

  // Пути для тестов
  const logDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../test-logs')
  const testLogPath = path.join(logDir, 'test.log')

  // Объявляем моки
  let mockFs
  let mockPath
  let mockEnv

  beforeEach(() => {
    logger.trace('Инициализация тестов rotate.js')

    // Устанавливаем фиксированное время для тестов
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
    // Добавляем мок для Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => new Date().getTime())

    // Создаем моки
    mockFs = {
      existsSync: vi.fn(),
      statSync: vi.fn(),
      promises: {
        readdir: vi.fn(),
        rename: vi.fn(),
        writeFile: vi.fn(),
        unlink: vi.fn()
      }
    }

    mockPath = {
      join: path.join,
      dirname: path.dirname
    }

    mockEnv = {
      LOG_MAX_SIZE: '1048576', // 1MB
      LOG_MAX_FILES: '5'
    }

    // По умолчанию файлы не существуют
    mockFs.existsSync.mockReturnValue(false)

    // Базовый размер файла
    mockFs.statSync.mockReturnValue({ size: 1000 })

    // Пустой список файлов
    mockFs.promises.readdir.mockResolvedValue([])

    // Устанавливаем моки
    setDependencies({
      fs: mockFs,
      path: mockPath,
      env: mockEnv,
      logger // Используем реальный логгер
    })

    logger.debug('Моки установлены')
  })

  afterEach(() => {
    logger.trace('Восстановление состояния после тестов')
    vi.useRealTimers()
    setDependencies(origDeps)
    vi.clearAllMocks()
  })

  describe('checkAndRotate() - Проверка и ротация файлов логов', () => {
    test('пропускает несуществующие файлы', async () => {
      logger.trace('Тест: пропуск несуществующих файлов')

      mockFs.existsSync.mockReturnValue(false)

      const config = {
        logFolder: logDir,
        maxSize: 1048576,
        maxFiles: 5
      }

      const result = await checkAndRotate(testLogPath, config)

      expect(result).toBe(false)
      expect(mockFs.statSync).not.toHaveBeenCalled()
      expect(mockFs.promises.rename).not.toHaveBeenCalled()

      logger.debug('Файл пропущен успешно')
    })

    test('пропускает файлы меньше лимита', async () => {
      logger.trace('Тест: пропуск файлов меньше лимита')

      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ size: 1000 })

      const config = {
        logFolder: logDir,
        maxSize: 1048576,
        maxFiles: 5
      }

      const result = await checkAndRotate(testLogPath, config)

      expect(result).toBe(false)
      expect(mockFs.promises.rename).not.toHaveBeenCalled()

      logger.debug('Файл пропущен из-за размера')
    })

    test('выполняет ротацию при превышении размера', async () => {
      logger.trace('Тест: ротация при превышении размера')

      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ size: 2097152 }) // 2MB
      mockFs.promises.readdir.mockResolvedValue([])

      const config = {
        logFolder: logDir,
        maxSize: 1048576, // 1MB
        maxFiles: 5
      }

      const result = await checkAndRotate(testLogPath, config)

      expect(result).toBe(true)

      const archivePath = `${testLogPath}.2024-01-01T12-00-00-000Z`
      expect(mockFs.promises.rename).toHaveBeenCalledWith(testLogPath, archivePath)
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(testLogPath, '')

      logger.debug('Ротация выполнена успешно')
    })

    test('ошибка при ротации', async () => {
      logger.trace('Тест: ошибка при ротации')

      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ size: 2097152 })
      mockFs.promises.rename.mockRejectedValue(new Error('Rename failed'))

      const config = {
        logFolder: logDir,
        maxSize: 1048576,
        maxFiles: 5
      }

      try {
        await checkAndRotate(testLogPath, config)
      } catch (error) {
        logger.debug('Перехвачена ошибка:', error)
        expect(error).toBeInstanceOf(SystemError)
        expect(error.code).toBe(LOGGER_ERROR_CODES.ROTATE_FAILED.code)
        expect(error.message).toContain('Rename failed')
      }
    })
  })

  describe('cleanupOldArchives() - Очистка старых архивов', () => {
    test('удаляет архивы сверх лимита', async () => {
      logger.trace('Тест: удаление старых архивов')

      const archiveFiles = [
        'test.log.2024-01-01T12-00-00-000Z',
        'test.log.2024-01-01T11-00-00-000Z',
        'test.log.2024-01-01T10-00-00-000Z',
        'test.log.2024-01-01T09-00-00-000Z',
        'test.log.2024-01-01T08-00-00-000Z',
        'test.log.2024-01-01T07-00-00-000Z'
      ]

      mockFs.promises.readdir.mockResolvedValue(archiveFiles)

      const config = {
        logFolder: logDir,
        maxFiles: 3
      }

      const deleted = await cleanupOldArchives(logDir, config)

      expect(deleted).toHaveLength(3)
      expect(mockFs.promises.unlink).toHaveBeenCalledTimes(3)

      logger.debug('Удалено архивов:', deleted.length)
    })

    test('ошибка при очистке', async () => {
      logger.trace('Тест: ошибка при очистке')

      mockFs.promises.readdir.mockResolvedValue(['test.log.2024-01-01T12-00-00-000Z'])
      mockFs.promises.unlink.mockRejectedValue(new Error('Delete failed'))

      const config = {
        logFolder: logDir,
        maxFiles: 0
      }

      try {
        await cleanupOldArchives(logDir, config)
      } catch (error) {
        logger.debug('Перехвачена ошибка:', error)
        expect(error).toBeInstanceOf(SystemError)
        expect(error.code).toBe(LOGGER_ERROR_CODES.CLEANUP_FAILED.code)
        expect(error.message).toContain('Delete failed')
      }
    })
  })
})
