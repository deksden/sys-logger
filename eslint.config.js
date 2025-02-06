import js from '@eslint/js'
import globals from 'globals'
import { FlatCompat } from '@eslint/eslintrc'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname
})

export default [
  js.configs.recommended,
  ...compat.extends('standard'),
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      // Обязательные правила для обработки ошибок
      'no-throw-literal': 'error', // Разрешаем throw только для объектов Error
      'handle-callback-err': 'error', // Требуем обработки ошибок в колбэках
      'no-unused-vars': ['error', { // Неиспользуемые переменные
        argsIgnorePattern: '^_', // Игнорируем аргументы начинающиеся с _
        varsIgnorePattern: '^_' // Игнорируем переменные начинающиеся с _
      }],

      // Стилистические правила
      'space-before-function-paren': ['error', 'always'], // Пробел перед скобками функции
      'no-multiple-empty-lines': ['error', { // Максимум пустых строк
        max: 2,
        maxEOF: 1,
        maxBOF: 0
      }],

      // Специфичные правила для тестов
      'no-unused-expressions': 'off', // Разрешаем неиспользуемые выражения в тестах

      // Отключаем некоторые излишне строгие правила
      'no-console': 'off', // Разрешаем console.log
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
    }
  }
]
