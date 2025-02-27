# Подсистема логирования (docs/logger/DOC_SYS_LOGGER.md, v0.1.2)

Подсистема SYS_LOGGER предоставляет унифицированный механизм логирования для всех компонентов системы. 

## Основные возможности

- 📝 Централизованное логирование через единый интерфейс
- 🎚️ Уровни логирования от trace до fatal
- 🔍 Фильтрация сообщений по namespace через DEBUG
- 🎨 Цветной вывод в консоль через pino-pretty 
- 📐 Форматированный вывод сообщений через pino-pretty
- 🔄 Автоматическая ротация лог файлов
- ⚠️ Структурированные ошибки через SYS_ERRORS

## Быстрый старт

```javascript
import { createLogger } from '../logger/logger.js'

// Создаем логгер с namespace
const logger = createLogger('my-app:module')

// Логируем сообщения разных уровней
logger.info('Application started')
logger.debug({ userId: 123 }, 'Processing user request')
logger.error({ error }, 'Operation failed')
```

## Конфигурация через переменные окружения

| Переменная | Описание | Значения по умолчанию |
|------------|----------|----------------------|
| LOG_LEVEL | Минимальный уровень сообщений | info |
| LOG_COLORIZE | Цветной вывод в консоль | true |
| LOG_FILE_OUTPUT | Запись в файл | false |
| LOG_CONSOLE_OUTPUT | Вывод в консоль | true |
| LOG_FOLDER | Папка для лог файлов | logs |
| DEBUG | Фильтр по namespace | * |

## Уровни логирования

Система поддерживает следующие уровни логирования (в порядке увеличения важности):

- **trace**: Входные параметры и детали выполнения функций
  ```javascript
  logger.trace({ params }, 'Function entry')
  ```

- **debug**: Результаты операций и промежуточные состояния
  ```javascript
  logger.debug({ result }, 'Operation completed')
  ```

- **info**: Важные бизнес-события и состояния системы
  ```javascript
  logger.info('User registered successfully')
  ```

- **warn**: Некритичные проблемы и предупреждения
  ```javascript
  logger.warn({ quota }, 'Disk space running low')
  ```

- **error**: Ошибки выполнения операций
  ```javascript
  logger.error({ error }, 'Failed to process request')
  ```

- **fatal**: Критические системные ошибки
  ```javascript
  logger.fatal({ error }, 'Database connection lost')
  ```

## Фильтрация по уровням через LOG_LEVEL

Переменная окружения LOG_LEVEL определяет минимальный уровень для вывода сообщений:

```bash
# Показывать все сообщения, начиная с debug
LOG_LEVEL=debug npm start

# Только warn и выше (warn, error, fatal)
LOG_LEVEL=warn npm start
```

Сообщения с уровнем ниже указанного в LOG_LEVEL не будут выводиться, даже если их namespace соответствует фильтру DEBUG.

## Работа с namespace 

### Создание логгеров с namespace

```javascript
// Создание логгеров с разными namespace
const authLogger = createLogger('auth')
const dbLogger = createLogger('database')
const apiLogger = createLogger('api:requests')
```

### Фильтрация по namespace через переменную DEBUG

Переменная окружения DEBUG управляет фильтрацией логов по namespace:

```bash
# Показать только конкретные namespace
DEBUG=auth,database npm start

# Показать все логи api и вложенных namespace
DEBUG=api:* npm start

# Показать все, кроме определенного namespace
DEBUG=*,-database npm start

# Комбинация правил
DEBUG=api:*,auth,-api:internal npm start
```

## Структурированное логирование

Логгер поддерживает несколько способов передачи данных:

### Контекст как объект

```javascript
// Базовое использование
logger.info('Message')

// С контекстом
logger.info({ userId: 123, action: 'login' }, 'User logged in')

// С обработкой ошибок
try {
  await operation()
} catch (error) {
  logger.error({ 
    error,
    context: { /* доп. информация */ }
  }, 'Operation failed')
}
```

### Placeholders в сообщениях

Логгер поддерживает использование placeholders в сообщениях. Значения для подстановки передаются дополнительными аргументами после сообщения:

```javascript
// Простая подстановка значений
logger.info('Processing user %s', username)

// Несколько placeholders
logger.debug('Request from %s to %s', sourceIp, targetIp)

// Placeholders с объектами
const user = { id: 123, name: 'John' }
logger.info('User data: %o', user)

// Комбинация контекста и placeholders 
logger.info({ requestId }, 'User %s made request to %s', username, endpoint)
```

Поддерживаемые placeholders:
- %s - строки, числа, любые скалярные значения
- %d - числа
- %o или %O - объекты (с разной глубиной вложенности)
- %j - JSON.stringify для объектов
- %% - вывод символа %

## Лучшие практики

1. **Правильный выбор уровня логирования**:
   - trace: для детального отслеживания выполнения
   - debug: для отладочной информации
   - info: для важных событий приложения
   - warn: для предупреждений
   - error: для ошибок операций
   - fatal: только для критических проблем

2. **Структурированное логирование**:
   - Всегда передавайте контекст первым параметром
   - Используйте понятные ключи в объекте контекста
   - Включайте идентификаторы и метки времени
   - Добавляйте метаданные для группировки

3. **Эффективная работа с namespace**:
   - Используйте иерархические имена
   - Разделяйте области двоеточием
   - Не делайте слишком длинные цепочки
   - Придерживайтесь соглашений об именовании

4. **Обработка ошибок**:
   - Всегда логируйте полный контекст ошибки
   - Включайте всю доступную информацию
   - Используйте правильные уровни
   - Не пропускайте важные ошибки

5. **Производительность**:
   - Не логируйте слишком часто
   - Используйте уровни для фильтрации
   - Избегайте тяжелых вычислений в логах
   - Проверяйте уровень перед сбором данных
