# Changelog

## [1.1.0] - 2026-07-12

- Added optional Codex (ChatGPT) usage monitoring, shown alongside Claude usage in the same popup
- Codex usage is fetched using the browser's existing chatgpt.com session, matching how Claude usage is fetched (no separate login/token needed)

## [1.0.6] - 2026-03-05

- Added request interval setting (contributed by [nkjzm](https://github.com/nkjzm))

## [1.0.5] - 2025-10-30

- Skip rendering usage meters when data is null
- Display inactive meters in disabled state

## [1.0.4] - 2025-10-22

- Improved error handling in monitor.js to prevent crashes when data is null

## [1.0.3] - 2025-10-17

- Fixed some words in documentation
- Added link to documentation

## [1.0.2] - 2025-10-17

- Added support for Firefox
- Avoided using innerHTML to prevent XSS vulnerabilities
- Migrated from background.service_worker to background.scripts

## [1.0.1] - 2025-10-17

- Removed background.js file (cleanup)

## [1.0.0] - 2025-10-16

- Initial release
