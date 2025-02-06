/**
 * @file vitest.config.js
 * @version 0.1.0
 */

import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { DefaultReporter } from 'vitest/reporters'

const __dirname = dirname(fileURLToPath(import.meta.url))

class CustomReporter extends DefaultReporter {
  onTestFileLoop () {
    // Переопределяем метод, чтобы не выводить имена файлов
  }
}

export default defineConfig({
  test: {
    // Общие настройки
    globals: true,
    environment: 'node',
    // setupFiles: ['dotenv/config'],
    exclude: ['**/node_modules/**', 'dist/**', '.idea/**', '.git/**'],
    testTimeout: 10000, // 10 секунд таймаут для тестов
    hookTimeout: 10000, // 10 секунд для хуков

    // Настройки изоляции и многопоточности
    // Отключаем многопоточность, т.к. у нас единая точка входа
    isolate: true,
    threads: false,

    // Настройки для запуска тестов
    silent: false,
    sequence: {
      hooks: 'list' // Запускаем хуки последовательно
    },

    // Настройки для watch режима
    watchExclude: ['**/node_modules/**', 'dist/**'],

    // Настройки для покрытия кода
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/*.test.js',
        '**/test/**',
        'test/**'
      ]
    },

    // Настройки для вывода результатов
    // reporters: ['default'],
    reporters: [new CustomReporter()],
    outputFile: {
      json: './test-results.json',
      showFilenames: false
    }
  },

  // Резолвинг путей и алиасы
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
