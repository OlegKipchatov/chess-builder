# UI-модули GachaChess

Текущая миграционная реализация: React, TypeScript strict, Vite, TanStack Router. Старые HTML-шаблоны и ручная синхронизация DOM не входят в runtime.

| Граница | Владелец |
| --- | --- |
| Bootstrap, shell, navigation | `src/app/bootstrap`, `App.tsx`, `app/router` |
| Theme, modal, PWA lifecycle | узкие providers в `src/app/providers` |
| Экран и PageHeader | `src/pages`, `shared/ui/Page.tsx` |
| Сеанс и post-game | `features/game-session` |
| Доска и анимации | `features/chessboard` |
| Архив, анализ, PGN, обучение | `pages/history`, `features/game-review` |
| Коллекция и сундуки | `pages/collection`, `pages/chests`, `features/inventory` |
| Hunt, Autochess, PvE | одноимённые pages/features/domain |
| Семантические токены и motion | `src/shared/styles` |

Компоненты возвращают JSX. Правила и формулы вынесены в domain; сохранение — в services/persistence. Обработчики событий задают команды, эффекты владеют подписками и отменой. Общие компоненты не импортируют страницы. Нельзя использовать innerHTML, ручную замену дерева или обработчики DOM как параллельную систему UI.

Сдача остаётся слева в MatchHeader; возврат принадлежит PageHeader. Виртуализация архива включается при более чем 50 записях; высота строки 104 px согласована с CSS. React экранирует названия наборов и импортированные значения. Focus изменяется через refs с preventScroll.

Базовые стили и публичные CSS-переменные сохраняют установленную визуальную систему. Доска использует CSS Module для своих слоёв. `motion:generate` получает CSS из `src/shared/styles/motion.ts`; `motion:check` проверяет синхронизацию. Vite/PWA собирает список ресурсов автоматически, включая lazy chunks и Workers.

Проверка: `npm run typecheck`, `npm run lint`, `npm test`, браузерные PWA/Stockfish сценарии. Визуальная приёмка обязательна при 320/390/1280 px, увеличении текста и reduced motion. DOM-тест не подтверждает фактическую геометрию браузера.
