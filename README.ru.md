<p align="center">
  <a href="https://context4.me/?utm_source=github&amp;utm_medium=readme&amp;utm_campaign=mcp-presence"><img src="plugins/context4/assets/logo.png" alt="Context4" width="96" /></a>
</p>

# Context4 MCP — поручите работу вашему AI

**Найти клиента. Разобраться в сделке. Собрать задачи команды.**

Context4 подключает AI к CRM и другим рабочим сервисам через MCP. Ваш помощник получает инструменты для поиска данных и выполнения поручений в аккаунтах, к которым вы дали доступ.

**[Открыть Context4 →](https://context4.me/?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence)** · [Подключить AI](https://context4.me/connect?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) · [Каталог сервисов](https://context4.me/apps?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) · [English](README.md)

## Начните с одного поручения

| Поручение | Подробнее на сайте |
| --- | --- |
| «Найди просроченные сделки в моей CRM и собери следующие шаги». | [amoCRM MCP](https://context4.me/apps/amocrm?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) · [Битрикс24 MCP](https://context4.me/apps/bitrix24?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |
| «Покажи открытые задачи моей команды в Linear». | [Linear MCP](https://context4.me/apps/linear?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |
| «Найди данные о клиенте в подключённых сервисах и подготовь сводку». | [Сценарии и условия их выполнения](https://context4.me/docs/business-cases?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |

Это примеры запросов, а не результаты внедрений. Доступность действий зависит от каталога, подключённых аккаунтов и ваших разрешений. Статус каждого коннектора и его возможности указаны на сайте.

## Как подключиться

1. **[Выберите ваш AI-клиент](https://context4.me/connect?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence).** На сайте есть инструкции для ChatGPT, Claude, Codex и Claude Code с ограничениями каждого клиента.
2. **Войдите и подключите рабочий аккаунт.** Подтвердите OAuth и доступ в браузере. Пароли, ключи и OAuth-токены не нужно передавать в чат или GitHub.
3. **Начните с чтения данных.** Попросите показать подключённые аккаунты и доступные задачи. Изменения и отправку сообщений поручайте явно, проверяйте результат.

Удалённый сервер: `https://context4.me/mcp`. Транспорт: Streamable HTTP. Вход: браузерный OAuth. Локальный сервер Context4 запускать не нужно.

[Пошаговая настройка](https://context4.me/docs/agent-setup?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) · [Что такое Context4](https://context4.me/docs/product-overview?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence)

## Плагины для Codex и Claude Code

Codex:

```sh
codex plugin marketplace add context4/plugins
codex plugin add context4@context4
```

Claude Code:

```sh
claude plugin marketplace add context4/plugins
claude plugin install context4@context4
```

Плагины включают MCP-конфигурацию и три навыка: работа с сервисами, настройка и сценарии между сервисами. Перезапустите клиент и пройдите OAuth, когда он запросит авторизацию. Установка файлов сама по себе не даёт доступа к аккаунту. Публичный пакет использует международный endpoint `https://ctx4.me/mcp`; оба адреса поддерживаются. Менять его ради русской инструкции не требуется.

[Установщик навыков, версии и разработка](README.md#skills-installer) · [Релизы](https://github.com/context4/plugins/releases)

## Полная документация — на сайте

| Что хотите узнать | Куда перейти |
| --- | --- |
| Какие сервисы можно подключить | [Каталог коннекторов](https://context4.me/apps?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |
| Как выполнить задачу через несколько сервисов | [Бизнес-сценарии](https://context4.me/docs/business-cases?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |
| Как работают MCP-инструменты | [Справочник инструментов](https://context4.me/docs/mcp-tools?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |
| Как управлять доступом и отключить аккаунт | [Доступ и отключение](https://context4.me/docs/access-and-disconnect?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |
| Как обрабатываются данные | [Обработка данных](https://context4.me/docs/data-handling?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |
| Сколько стоит использование | [Стоимость](https://context4.me/pricing?utm_source=github&utm_medium=readme&utm_campaign=mcp-presence) |

[Поддержка](https://context4.me/support) · [Конфиденциальность](https://context4.me/privacy) · [Условия использования](https://context4.me/terms)

MIT распространяется на публичные файлы пакета; лицензии и атрибуции навыков сохранены. Использование облачного сервиса регулируется условиями на сайте. Исходный код backend в этот репозиторий не входит.
