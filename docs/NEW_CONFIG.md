# Конфигурация SYS_LOGGER через файлы (docs/CONFIG_FILES.md, v0.1.0)

## Обоснование

Система `SYS_LOGGER` в настоящее время поддерживает конфигурацию через переменные окружения (`.env`). Такой подход имеет
ряд ограничений, особенно при использовании в тестовых средах, где:

- При запуске тестов требуется специальная настройка переменных окружения
- Сложно иметь разные конфигурации для разных тестовых наборов
- Нет возможности программно манипулировать конфигурацией во время выполнения
- Версионирование конфигурации требует дополнительных усилий

Предлагаемое решение - **дополнительная поддержка конфигурации через JavaScript-файлы** (`sys-logger.config.js`) -
позволит устранить эти недостатки, сохраняя обратную совместимость с существующим механизмом.

## Механизм поиска конфигурации

Система использует следующий алгоритм для поиска файла конфигурации:

1. Начинает поиск с текущей рабочей директории `process.cwd()`
2. Проверяет наличие файла конфигурации (`sys-logger.config.js`) в текущей директории
3. Если файл не найден, переходит к родительской директории
4. Процесс повторяется до нахождения первого файла конфигурации или до достижения корня файловой системы
5. Поиск останавливается при обнаружении маркеров корня проекта (`.git`, `package.json`)

### Преимущества этого подхода:

- ✅ Интуитивно понятен для разработчиков (так работают ESLint, Prettier, TypeScript)
- ✅ Поддерживает вложенные проекты и монорепозитории
- ✅ Позволяет иметь разные конфигурации для разных частей проекта
- ✅ Не требует явного указания пути к конфигурации

## Структура конфигурационного файла

Файл `sys-logger.config.js` должен экспортировать объект с конфигурацией:

```javascript
// sys-logger.config.js
export default {
  // Базовые настройки
  logLevel: 'info',
  logFolder: 'logs',
  fileOutput: true,
  consoleOutput: true,
  colorize: true,
  sync: false,
  pretty: true,

  // Настройки обработки объектов
  maxDepth: 8,
  mapDepthOnly: true,

  // Фильтрация по namespace
  debug: '*,-vite:*,-vite-node:*',

  // Множественные транспорты
  transports: [
    {
      type: 'console',
      level: 'debug',
      colors: true,
      translateTime: 'SYS:standard'
    },
    {
      type: 'file',
      level: 'info',
      folder: 'logs',
      filename: '{app_name}_{date}.log',
      rotate: true,
      rotateMaxSize: 10485760, // 10MB
      rotateMaxFiles: 5
    }
  ]
};
```

## Поддерживаемые ключи конфигурации

### Базовые настройки

| Ключ            | Описание                           | Тип     | По умолчанию |
|-----------------|------------------------------------|---------|--------------|
| `logLevel`      | Уровень логирования                | string  | 'info'       |
| `logFolder`     | Папка для лог файлов               | string  | 'logs'       |
| `fileOutput`    | Включить запись в файл             | boolean | true         |
| `consoleOutput` | Включить вывод в консоль           | boolean | true         |
| `colorize`      | Использовать цветной вывод         | boolean | true         |
| `sync`          | Использовать синхронную запись     | boolean | false        |
| `pretty`        | Использовать форматированный вывод | boolean | false        |

### Настройки обработки объектов

| Ключ           | Описание                            | Тип     | По умолчанию |
|----------------|-------------------------------------|---------|--------------|
| `maxDepth`     | Максимальная глубина вложенности    | number  | 8            |
| `mapDepthOnly` | Ограничивать глубину только для Map | boolean | true         |

### Фильтрация по namespace

| Ключ    | Описание                          | Тип    | По умолчанию |
|---------|-----------------------------------|--------|--------------|
| `debug` | Паттерны фильтрации (как в DEBUG) | string | '*'          |

### Транспорты

Массив объектов с настройками для каждого транспорта:

#### Общие настройки транспортов

| Ключ           | Описание                        | Тип     | По умолчанию |
|----------------|---------------------------------|---------|--------------|
| `type`         | Тип транспорта (console, file)  | string  | -            |
| `level`        | Уровень логирования             | string  | 'info'       |
| `enabled`      | Включение/отключение транспорта | boolean | true         |
| `sync`         | Синхронная запись               | boolean | false        |
| `timestamp`    | Добавлять временную метку       | boolean | true         |
| `messageKey`   | Ключ для сообщения              | string  | 'msg'        |
| `timestampKey` | Ключ для временной метки        | string  | 'time'       |
| `levelKey`     | Ключ для уровня                 | string  | 'level'      |

#### Консольный транспорт

| Ключ             | Описание                  | Тип     | По умолчанию   |
|------------------|---------------------------|---------|----------------|
| `colors`         | Цветной вывод             | boolean | true           |
| `translateTime`  | Формат времени            | string  | 'SYS:standard' |
| `ignore`         | Поля для игнорирования    | string  | 'pid,hostname' |
| `singleLine`     | Однострочный вывод        | boolean | false          |
| `hideObjectKeys` | Скрываемые ключи объектов | string  | ''             |
| `showMetadata`   | Показывать метаданные     | boolean | false          |

#### Файловый транспорт

| Ключ             | Описание                                                 | Тип           | По умолчанию     |
|------------------|----------------------------------------------------------|---------------|------------------|
| `folder`         | Папка для логов                                          | string        | 'logs'           |
| `filename`       | Шаблон имени файла                                       | string        | '{app_name}.log' |
| `destination`    | Полный путь или файловый дескриптор (1=stdout, 2=stderr) | string/number | ''               |
| `mkdir`          | Создавать папку если не существует                       | boolean       | true             |
| `append`         | Дописывать в существующий файл                           | boolean       | true             |
| `prettyPrint`    | Применить форматирование pino-pretty                     | boolean       | false            |
| `rotate`         | Включить ротацию файлов                                  | boolean       | false            |
| `rotateMaxSize`  | Максимальный размер файла                                | number        | 10485760 (10MB)  |
| `rotateMaxFiles` | Максимальное количество архивов                          | number        | 5                |
| `rotateCompress` | Сжимать архивы                                           | boolean       | false            |

## Порядок приоритетов

Система использует следующий порядок приоритетов для определения конфигурации:

1. **Переменные окружения** (высший приоритет)
2. **Файл конфигурации** из ближайшей директории
3. **Значения по умолчанию** (низший приоритет)

Это позволяет переопределять настройки на разных уровнях, сохраняя гибкость.

## Особенности настройки вывода в stdout и stderr

Для приложений, работающих в контейнерах или серверных средах, часто требуется настройка вывода логов в стандартные
потоки stdout и stderr:

1. Используйте **числовые файловые дескрипторы** в параметре `destination`:
    - `1` — для stdout (стандартный вывод)
    - `2` — для stderr (стандартный вывод ошибок)

2. **Разделение уровней логирования** между потоками:
    - Обычно в stdout направляют сообщения уровней info, debug, trace
    - В stderr направляют сообщения уровней warn, error, fatal

3. **Настройка форматирования для контейнеров**:
    - В контейнерных средах (Docker, Kubernetes) рекомендуется отключать цветовое форматирование
    - Для stdout/stderr в контейнерах лучше использовать формат JSON (отключать pretty)

Пример конфигурации для контейнерной среды:

```javascript
export default {
  logLevel: 'info',
  transports: [
    {
      type: 'file',
      level: 'info',
      destination: 1, // stdout
      pretty: false, // без форматирования для машинной обработки
      colors: false // без цветов
    },
    {
      type: 'file',
      level: 'error',
      destination: 2, // stderr
      pretty: false,
      colors: false
    }
  ]
};
```

## Примеры использования

### Базовая конфигурация

```javascript
// sys-logger.config.js
export default {
  logLevel: 'debug',
  consoleOutput: true,
  fileOutput: false,
  colorize: true
};
```

### Конфигурация для тестов

```javascript
// test/sys-logger.config.js
export default {
  logLevel: 'error', // Минимальный уровень для тестов
  consoleOutput: false, // Отключаем вывод в консоль в тестах
  fileOutput: true,
  logFolder: 'test-logs', // Отдельная папка для логов тестов
  sync: true, // Синхронная запись для тестов
  pretty: false,
  debug: 'test:*', // Только логи с namespace test:*

  // Специальный транспорт для логов тестов
  transports: [
    {
      type: 'file',
      level: 'trace',
      folder: 'test-logs',
      filename: 'test_{datetime}.log'
    }
  ]
};
```

### Конфигурация для продакшена

```javascript
// sys-logger.config.js для продакшена
export default {
  logLevel: 'info',
  consoleOutput: false,
  fileOutput: true,
  logFolder: '/var/log/app',

  transports: [
    {
      type: 'file',
      level: 'info',
      folder: '/var/log/app',
      filename: '{app_name}_{date}.log',
      rotate: true,
      rotateMaxSize: 104857600, // 100MB
      rotateMaxFiles: 30,
      rotateCompress: true
    },
    {
      type: 'file',
      level: 'error',
      folder: '/var/log/app/errors',
      filename: 'errors_{date}.log',
      rotate: true
    }
  ]
};
```

### Настройка вывода в stdout и stderr

```javascript
// sys-logger.config.js с выводом в stdout и stderr
export default {
  logLevel: 'info',
  consoleOutput: false,
  fileOutput: false, // Отключаем стандартный файловый вывод

  transports: [
    {
      // Вывод обычных логов в stdout
      type: 'file',
      level: 'info',
      destination: 1, // 1 - файловый дескриптор для stdout
      sync: false
    },
    {
      // Вывод ошибок в stderr
      type: 'file',
      level: 'error',
      destination: 2, // 2 - файловый дескриптор для stderr
      sync: true // Синхронная запись для ошибок
    }
  ]
};
```

## Интеграция с тестами

Данный подход особенно полезен для тестов, так как:

1. **Отдельная конфигурация для тестов** — можно разместить `sys-logger.config.js` в папке `test/`
2. **Не нужно настраивать переменные окружения при запуске тестов**
3. **Разные конфигурации для разных наборов тестов**
4. **Программное управление конфигурацией**

### Пример тестовой конфигурации

```javascript
// test/integration/sys-logger.config.js
export default {
  logLevel: 'error',
  consoleOutput: false,
  fileOutput: true,
  logFolder: 'test-logs/integration',
  sync: true
};

// test/unit/sys-logger.config.js
export default {
  logLevel: 'trace', // Для unit-тестов можно использовать trace
  consoleOutput: false,
  fileOutput: true,
  logFolder: 'test-logs/unit',
  sync: true
};
```

## Реализация функции поиска конфигурации

```javascript
import fs from 'fs'
import path from 'path'

/**
 * Ищет файл конфигурации, начиная с указанной директории
 * и двигаясь вверх по иерархии папок
 *
 * @param {string} startDir - Начальная директория поиска
 * @param {string} configFilename - Имя файла конфигурации
 * @param {Object} options - Дополнительные опции
 * @param {number} options.maxDepth - Максимальная глубина поиска
 * @param {string[]} options.stopMarkers - Файлы, указывающие на корень проекта
 * @returns {string|null} - Путь к найденному файлу или null
 */
function findConfigFile (startDir, configFilename = 'sys-logger.config.js', options = {}) {
  const { maxDepth = 10, stopMarkers = ['package.json', '.git'] } = options;
  let currentDir = path.resolve(startDir);
  let depth = 0;

  while (depth < maxDepth) {
    // Проверяем наличие файла конфигурации
    const configPath = path.join(currentDir, configFilename);
    if (fs.existsSync(configPath)) {
      return configPath;
    }

    // Проверяем наличие маркеров остановки
    for (const marker of stopMarkers) {
      if (fs.existsSync(path.join(currentDir, marker))) {
        // Нашли маркер, но конфигурации нет - значит ее нет в проекте
        if (marker !== configFilename) {
          return null;
        }
      }
    }

    // Получаем родительскую директорию
    const parentDir = path.dirname(currentDir);

    // Достигли корня файловой системы
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  return null; // Конфигурация не найдена
}
```

## Заключение

Предлагаемый механизм конфигурации через файлы `sys-logger.config.js` дополнит существующую систему на основе переменных
окружения и повысит гибкость, особенно для тестовых сред. Механизм поиска конфигурации, начиная с текущей директории и
двигаясь вверх, обеспечит удобство и соответствие ожиданиям разработчиков, знакомых с аналогичными подходами в других
инструментах.
