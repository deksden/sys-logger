# Подсистема логирования (SYS-LOGGER.md, v0.8.5)

*   **changelog:**
    *   v0.8.5 (2025-06-11): Обновлена и расширена документация по настройке через переменные окружения.

Подсистема SYS-LOGGER предоставляет унифицированный механизм логирования для всех компонентов системы.

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
- ✂️ Ограничение длины строк в объектах логирования
- ✨ **Расширенный API логгера:** Возвращаемый объект включает методы `.child()`, `.bindings()`, `.isLevelEnabled()`, `.silent()` и свойство `.level` для большей совместимости с `pino`.

## Быстрый старт

```javascript
import { createLogger } from '../logger/logger.js'

// Создаем логгер с namespace
const logger = createLogger('my-app:module')

// Логируем сообщения разных уровней
logger.info('Application started')
logger.debug({ userId: 123 }, 'Processing user request')
logger.error(new Error('Something failed'), 'Operation failed')

// Создание дочернего логгера
const childLogger = logger.child({ requestId: 'abc-123' })
childLogger.info('Handling request');
// -> Лог будет содержать { namespace: 'my-app:module', requestId: 'abc-123' }

// Проверка уровня перед затратной операцией
if (logger.isLevelEnabled('debug')) {
  const data = prepareExpensiveData();
  logger.debug({ data }, 'Expensive data prepared');
}

// Изменение уровня для конкретного экземпляра
logger.level = 'trace';
logger.trace('Trace log enabled temporarily');
logger.level = 'info'; // Возвращаем обратно
```

## Конфигурация через переменные окружения

Конфигурация логгера осуществляется через переменные окружения. Система поддерживает два режима: "легаси" (для обратной совместимости) и современный режим "множественных транспортов".

> **⚠️ Важно:** Если в конфигурации задана **хотя бы одна** переменная `TRANSPORT{N}`, система переключается в режим множественных транспортов, и все "легаси" переменные (`LOG_FILE_OUTPUT`, `LOG_CONSOLE_OUTPUT`, `LOG_FOLDER`, `LOG_COLORIZE`) **полностью игнорируются**.

### Легаси-настройки (только для обратной совместимости)

Эти переменные используются, только если **не задано ни одного** транспорта `TRANSPORT{N}`.

| Переменная         | Описание                      | Значения по умолчанию |
|--------------------|-------------------------------|-----------------------|
| `LOG_LEVEL`        | Минимальный уровень сообщений | `info`                |
| `LOG_COLORIZE`     | Цветной вывод в консоль       | `true`                |
| `LOG_FILE_OUTPUT`  | Запись в файл                 | `false`               |
| `LOG_CONSOLE_OUTPUT`| Вывод в консоль               | `true`                |
| `LOG_FOLDER`       | Папка для лог файлов          | `logs`                |
| `DEBUG`            | Фильтр по namespace           | `*` (или не задан)    |

### Настройки обработки строк и объектов

Эти настройки являются глобальными и работают в обоих режимах.

| Переменная                | Описание                                  | Значения по умолчанию |
|---------------------------|-------------------------------------------|-----------------------|
| `LOG_MAX_DEPTH`           | Максимальная глубина для Map структур     | `8`                   |
| `LOG_MAX_STRING_LENGTH`   | Максимальная длина строк (0 = без лимита) | `0`                   |
| `LOG_TRUNCATION_MARKER`   | Маркер обрезки для длинных строк          | `...`                 |

### Множественные транспорты (Рекомендуемый способ)

Это основной и наиболее гибкий способ настройки. Вы можете определить несколько "пунктов назначения" для логов, настроив переменные `TRANSPORT{N}` и `TRANSPORT{N}_*`, где `N` — порядковый номер транспорта (начиная с 1).

#### Поддерживаемые типы транспортов

-   `console`: Вывод в консоль с форматированием через `pino-pretty`.
-   `file`: Запись в файл с поддержкой ротации и возможностью вывода в `stdout`/`stderr`.

#### Общие параметры транспортов

Эти параметры применяются к любому типу транспорта.

| Переменная                 | Описание                        | По умолчанию |
|----------------------------|---------------------------------|--------------|
| `TRANSPORT{N}`             | Тип транспорта (`console`, `file`) | -            |
| `TRANSPORT{N}_LEVEL`       | Уровень логирования для транспорта | `info`       |
| `TRANSPORT{N}_ENABLED`     | Включение/отключение (`true`/`false`) | `true`       |
| `TRANSPORT{N}_SYNC`        | Синхронная запись (`true`/`false`) | `false`      |

#### Параметры консольного транспорта (`type: 'console'`)

| Переменная                    | Описание                  | По умолчанию |
|-------------------------------|---------------------------|----------------|
| `TRANSPORT{N}_COLORS`         | Цветной вывод             | `true`         |
| `TRANSPORT{N}_TRANSLATE_TIME`  | Формат времени (`SYS:standard`) | `SYS:standard` |
| `TRANSPORT{N}_IGNORE`          | Поля для игнорирования (`pid,hostname`)| `pid,hostname` |
| `TRANSPORT{N}_SINGLE_LINE`     | Однострочный вывод        | `false`        |
| `TRANSPORT{N}_HIDE_OBJECT_KEYS`| Скрываемые ключи объектов (через запятую) | `''`           |
| `TRANSPORT{N}_SHOW_METADATA`   | Показывать метаданные     | `false`        |
| `TRANSPORT{N}_TIMESTAMP_KEY`   | Ключ для временной метки  | `time`         |

#### Параметры файлового транспорта (`type: 'file'`)

| Переменная                    | Описание                                                 | По умолчанию     |
|-------------------------------|----------------------------------------------------------|------------------|
| `TRANSPORT{N}_FOLDER`          | Папка для лог-файлов (игнорируется, если задан `_DESTINATION`) | `logs`           |
| `TRANSPORT{N}_FILENAME`        | Шаблон имени файла (игнорируется, если задан `_DESTINATION`) | `{app_name}.log` |
| `TRANSPORT{N}_DESTINATION`     | Полный путь к файлу или дескриптор (`1`=stdout, `2`=stderr) | `''`             |
| `TRANSPORT{N}_MKDIR`           | Создавать папку, если не существует                       | `true`           |
| `TRANSPORT{N}_APPEND`          | Дописывать в существующий файл                           | `true`           |
| `TRANSPORT{N}_PRETTY_PRINT`    | Применить форматирование `pino-pretty` (для `stdout`/`stderr`) | `false`          |
| `TRANSPORT{N}_ROTATE`          | Включить ротацию файлов                                  | `false`          |
| `TRANSPORT{N}_ROTATE_MAX_SIZE` | Максимальный размер файла в байтах                       | `10485760` (10MB)|
| `TRANSPORT{N}_ROTATE_MAX_FILES`| Максимальное количество архивов                          | `5`              |
| `TRANSPORT{N}_ROTATE_COMPRESS` | Сжимать архивы (`true`/`false`)                          | `false`          |

#### Шаблоны в именах файлов

В настройке `TRANSPORT{N}_FILENAME` можно использовать следующие плейсхолдеры:

-   `{date}` - текущая дата (YYYY-MM-DD)
-   `{time}` - текущее время (HH-mm-ss)
-   `{datetime}` - комбинация даты и времени (YYYY-MM-DD_HH-mm-ss)
-   `{app_name}` - имя приложения из `package.json`
-   `{app_version}` - версия приложения из `package.json`
-   `{pid}` - ID процесса
-   `{hostname}` - имя хоста

Пример: `TRANSPORT2_FILENAME=logs/{app_name}_{date}.log` -> `logs/my-app_2023-01-01.log`

## Уровни логирования

Система поддерживает следующие уровни логирования (в порядке увеличения важности):

-   **trace**: Детальная отладка, вход/выход функций.
-   **debug**: Основная отладочная информация, промежуточные состояния.
-   **info**: Важные события и состояния системы.
-   **warn**: Некритичные проблемы, предупреждения.
-   **error**: Ошибки выполнения операций.
-   **fatal**: Критические системные ошибки, обычно приводящие к остановке.

### Приоритет настройки уровней

Уровень фильтрации определяется по следующему приоритету (от высшего к низшему):
1.  **`logger.level`** (свойство экземпляра): Позволяет **динамически** изменить уровень для конкретного экземпляра логгера.
2.  **`TRANSPORT{N}_LEVEL`** (переменная окружения): Переопределяет минимальный уровень для *конкретного* транспорта.
3.  **`LOG_LEVEL`** (переменная окружения): Задает **глобальный** минимальный уровень для *всех* логгеров, если он не переопределен на более высоком уровне.

## Работа с namespace и DEBUG

Фильтрация по `namespace` позволяет включать или выключать вывод логов от определенных модулей. Логика основана на модуле `debug`.

### Примеры использования `DEBUG`

```bash
# Показать все логи (включая логи без namespace)
DEBUG=*

# Показать только логи от модулей auth и database
DEBUG=auth,database

# Показать все логи, начинающиеся с 'api:' (api:requests, api:responses, etc.)
DEBUG=api:*

# Показать все, кроме логов от database
DEBUG=*,-database

# Комбинация: показать все от api:* и auth, но скрыть api:internal
DEBUG=api:*,auth,-api:internal
```

## Расширенное API Логгера

Объект, возвращаемый `createLogger`, предоставляет дополнительные методы и свойства для управления и интроспекции.

### `logger.child(bindings)`

Создает новый экземпляр логгера, который наследует конфигурацию родителя (уровень, транспорты), `namespace` родителя (для `DEBUG`-фильтрации) и добавляет указанные `bindings` (ключ-значение) ко всем своим лог-сообщениям.

```javascript
const parent = createLogger('http');
const requestLogger = parent.child({ method: 'GET', url: '/users' });

requestLogger.info('Processing request');
// -> { "level": 30, ..., "namespace": "http", "method": "GET", "url": "/users", "msg": "Processing request" }
```

### `logger.bindings()`

Возвращает объект, содержащий все `bindings`, активные для данного экземпляра логгера (включая `namespace`, если он был задан, и `bindings`, добавленные через `.child()`).

```javascript
const logger = createLogger('db').child({ connectionId: 12 });
console.log(logger.bindings());
// -> { namespace: 'db', connectionId: 12 }
```

### `logger.level` (get/set)

Позволяет получить или установить **строковое** имя минимального уровня логирования для данного экземпляра логгера. Изменение уровня родителя влияет на дочерние элементы, созданные *после* изменения.

```javascript
const logger = createLogger('service');
console.log(logger.level); // -> 'info' (или что задано глобально)

logger.level = 'debug';
logger.debug('Debug message now visible');

logger.level = 'warn';
logger.info('Info message now hidden');
```

### `logger.isLevelEnabled(levelName)`

Возвращает `true`, если сообщения с указанным `levelName` (строка) будут записаны этим экземпляром логгера (учитывается и текущий `logger.level`, и `DEBUG`-фильтр). Полезно для предотвращения затратных вычислений.

```javascript
const logger = createLogger('heavy:calc');
logger.level = 'info';

if (logger.isLevelEnabled('debug')) { // Вернет false
  const result = performHeavyCalculation();
  logger.debug({ result }, 'Calculation done'); // Этот лог не будет записан
}
```

### `logger.silent()`

Временно полностью отключает вывод для данного экземпляра логгера. Вызов `pinoInstance.silent()`. Редко используется.

## Структурированное логирование

Логгер поддерживает несколько способов передачи данных:

### Контекст как объект

```javascript
logger.info('Message') // Только сообщение
logger.info({ userId: 123, action: 'login' }, 'User logged in') // Контекст + сообщение
logger.debug({ data: myDataObject }) // Только контекст
```

### Логирование ошибок

Рекомендуется передавать объект ошибки в поле `err`:

```javascript
try {
  await operation()
} catch (error) {
  logger.error({ err: error, context: { userId: 123 } }, 'Operation failed')
}
```

Можно передать ошибку и первым аргументом:

```javascript
logger.error(new Error('Direct error'), 'Optional message');
```

### Placeholders в сообщениях

Логгер поддерживает использование placeholders. Значения для подстановки передаются дополнительными аргументами.

```javascript
logger.info('Processing user %s', username)
logger.debug('Request from %s to %s', sourceIp, targetIp)
logger.info('User data: %j', { id: 1, name: 'Test' }) // %j для объектов
logger.info({ requestId }, 'User %s made request to %s', username, endpoint) // Комбинация
```

Поддерживаемые placeholders: `%s`, `%d`, `%i`, `%f`, `%o`, `%O`, `%j`, `%%`.

## Преобразование Map в обычные объекты

По умолчанию система автоматически преобразует структуры Map в обычные объекты для логирования, ограниченные глубиной `LOG_MAX_DEPTH` (по умолчанию 8).

```javascript
const myMap = new Map([['key1', 'value1'], ['key2', { nested: 'object' }]]);
logger.info({ data: myMap });
// -> { data: { key1: 'value1', key2: { nested: 'object' } } }
```

## Ограничение длины строк

Система может ограничивать длину строковых значений в объектах и одиночных сообщений (`LOG_MAX_STRING_LENGTH`, `LOG_TRUNCATION_MARKER`).

```javascript
// LOG_MAX_STRING_LENGTH=20
// LOG_TRUNCATION_MARKER=...
const longText = 'Очень длинный текст, который будет обрезан для лога.';
logger.info({ details: longText });
// -> { details: 'Очень длинный текст,...' }
logger.warn(longText);
// -> 'Очень длинный текст,...'
```

## Лучшие практики

1.  **Уровни логирования:** Используйте уровни семантически правильно.
2.  **Структура:** Передавайте контекст первым аргументом ({ `key`: `value` }). Используйте `err` для ошибок.
3.  **Namespace:** Используйте иерархию (`app:module:submodule`) и `DEBUG` для фильтрации.
4.  **Дочерние логгеры (`.child()`):** Используйте для добавления контекста (ID запроса, ID пользователя) к группе связанных логов.
5.  **Производительность:**
    *   Не логируйте избыточно в циклах.
    *   Используйте `logger.isLevelEnabled(level)` перед подготовкой *действительно* дорогих данных для логов уровня `debug` или `trace`.
    *   В продакшене обычно достаточно уровня `info`.
6.  **Транспорты:** Настройте отдельные транспорты (например, файл для ошибок `level: 'error'`, консоль для `level: 'info'`) через переменные `TRANSPORT{N}` для лучшего управления логами.
