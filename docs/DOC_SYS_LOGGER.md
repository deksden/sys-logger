# Подсистема логирования (docs/logger/DOC_SYS_LOGGER.md, v0.3.0)

Подсистема SYS_LOGGER предоставляет унифицированный механизм логирования для всех компонентов системы.

## Основные возможности

- 📝 Централизованное логирование через единый интерфейс
- 🎚️ Уровни логирования от trace до fatal
- 🔍 Фильтрация сообщений по namespace через DEBUG
- 🎨 Цветной вывод в консоль через pino-pretty
- 📐 Форматированный вывод сообщений через pino-pretty
- 🔄 Автоматическая ротация лог файлов
- ⚠️ Структурированные ошибки через SYS_ERRORS
- 🔌 Множественные настраиваемые транспорты
- 📦 Автоматическое преобразование Map структур в обычные объекты

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

### Базовые настройки (обратная совместимость)

| Переменная         | Описание                      | Значения по умолчанию |
|--------------------|-------------------------------|-----------------------|
| LOG_LEVEL          | Минимальный уровень сообщений | info                  |
| LOG_COLORIZE       | Цветной вывод в консоль       | true                  |
| LOG_FILE_OUTPUT    | Запись в файл                 | false                 |
| LOG_CONSOLE_OUTPUT | Вывод в консоль               | true                  |
| LOG_FOLDER         | Папка для лог файлов          | logs                  |
| DEBUG              | Фильтр по namespace           | *                     |

### Настройки обработки Map структур

```bash
# Максимальная глубина вложенности для Map структур
LOG_MAX_DEPTH=8
```

По умолчанию система ограничивает глубину вложенности для Map структур до 8 уровней,
при превышении которой Map заменяется строкой `[Max Map Depth Reached]`.

Переменная `LOG_MAP_DEPTH_ONLY` присутствует для обратной совместимости,
но больше не влияет на поведение системы - обычные объекты никогда не ограничиваются
по глубине и всегда обрабатываются полностью, независимо от настроек.

### Множественные транспорты

Система поддерживает настройку нескольких транспортов через переменные окружения вида `TRANSPORT{N}` и `TRANSPORT{N}_*`,
где N - порядковый номер транспорта (начиная с 1).

#### Настройка множественных транспортов

```bash
# Консольный транспорт с уровнем info
TRANSPORT1=console
TRANSPORT1_LEVEL=info
TRANSPORT1_COLORS=true

# Файловый транспорт с уровнем debug
TRANSPORT2=file
TRANSPORT2_LEVEL=debug
TRANSPORT2_FOLDER=logs
TRANSPORT2_FILENAME={app_name}_{date}.log

# Отдельный файловый транспорт для ошибок
TRANSPORT3=file
TRANSPORT3_LEVEL=error
TRANSPORT3_FILENAME=errors_{date}.log
```

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

## Множественные транспорты

### Поддерживаемые типы транспортов

- **console**: Вывод в консоль с форматированием через pino-pretty
- **file**: Запись в файл с поддержкой шаблонов в имени и ротацией

### Общие параметры транспортов

| Переменная                 | Описание                        | Значения по умолчанию |
|----------------------------|---------------------------------|-----------------------|
| TRANSPORT{N}               | Тип транспорта (console, file)  | -                     |
| TRANSPORT{N}_LEVEL         | Уровень логирования             | info                  |
| TRANSPORT{N}_ENABLED       | Включение/отключение транспорта | true                  |
| TRANSPORT{N}_SYNC          | Синхронная запись               | false                 |
| TRANSPORT{N}_TIMESTAMP     | Добавлять временную метку       | true                  |
| TRANSPORT{N}_MESSAGE_KEY   | Ключ для сообщения              | msg                   |
| TRANSPORT{N}_TIMESTAMP_KEY | Ключ для временной метки        | time                  |
| TRANSPORT{N}_LEVEL_KEY     | Ключ для уровня логирования     | level                 |

### Параметры консольного транспорта

| Переменная                    | Описание                  | Значения по умолчанию |
|-------------------------------|---------------------------|-----------------------|
| TRANSPORT{N}_COLORS           | Цветной вывод             | true                  |
| TRANSPORT{N}_TRANSLATE_TIME   | Формат времени            | SYS:standard          |
| TRANSPORT{N}_IGNORE           | Поля для игнорирования    | pid,hostname          |
| TRANSPORT{N}_SINGLE_LINE      | Однострочный вывод        | false                 |
| TRANSPORT{N}_HIDE_OBJECT_KEYS | Скрываемые ключи объектов | ''                    |
| TRANSPORT{N}_SHOW_METADATA    | Показывать метаданные     | false                 |

### Параметры файлового транспорта

| Переменная                    | Описание                             | Значения по умолчанию |
|-------------------------------|--------------------------------------|-----------------------|
| TRANSPORT{N}_FOLDER           | Папка для логов                      | logs                  |
| TRANSPORT{N}_FILENAME         | Шаблон имени файла                   | {app_name}.log        |
| TRANSPORT{N}_DESTINATION      | Полный путь или дескриптор           | ''                    |
| TRANSPORT{N}_MKDIR            | Создавать папку если не существует   | true                  |
| TRANSPORT{N}_APPEND           | Дописывать в существующий файл       | true                  |
| TRANSPORT{N}_PRETTY_PRINT     | Применить форматирование pino-pretty | false                 |
| TRANSPORT{N}_ROTATE           | Включить ротацию файлов              | false                 |
| TRANSPORT{N}_ROTATE_MAX_SIZE  | Максимальный размер файла            | 10485760 (10MB)       |
| TRANSPORT{N}_ROTATE_MAX_FILES | Максимальное количество архивов      | 5                     |
| TRANSPORT{N}_ROTATE_COMPRESS  | Сжимать архивы                       | false                 |

### Шаблоны в именах файлов

В настройке `TRANSPORT{N}_FILENAME` можно использовать следующие плейсхолдеры:

- `{date}` - текущая дата (YYYY-MM-DD)
- `{time}` - текущее время (HH-mm-ss)
- `{datetime}` - комбинация даты и времени (YYYY-MM-DD_HH-mm-ss)
- `{app_name}` - имя приложения из package.json
- `{app_version}` - версия приложения из package.json
- `{pid}` - ID процесса
- `{hostname}` - имя хоста

Пример:

```
TRANSPORT2_FILENAME=logs/{app_name}_{date}.log
```

Будет преобразовано в: `logs/my-app_2023-01-01.log`

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

Логгер поддерживает использование placeholders в сообщениях. Значения для подстановки передаются дополнительными
аргументами после сообщения:

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

## Преобразование Map в обычные объекты

По умолчанию система автоматически преобразует структуры Map в обычные объекты для логирования:

```javascript
const myMap = new Map([
  ['key1', 'value1'],
  ['key2', { nested: 'object' }]
]);

logger.info({ data: myMap });
// Будет преобразовано в:
// { data: { key1: 'value1', key2: { nested: 'object' } } }
```

Это преобразование ограничено максимальной глубиной для предотвращения переполнения буфера при циклических структурах:

```bash
# Максимальная глубина вложенности Map структур
LOG_MAX_DEPTH=8
```

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

6. **Разделение логов по транспортам**:
    - Используйте отдельные транспорты для разных уровней и типов логов
    - Направляйте ошибки в отдельный файл для легкой диагностики
    - Используйте шаблоны имен файлов для удобной организации
    - Оптимизируйте настройки ротации для разных типов логов
