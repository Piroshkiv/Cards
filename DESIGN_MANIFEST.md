# Design Manifest — Cards App

## Философия
Светлый, минималистичный интерфейс без лишних украшений. Один экран — одна задача.
Никаких градиентов, теней-«стопок» и декоративных элементов.

---

## Цветовая палитра

```
--bg:         #F7F7F5   /* фон страниц */
--surface:    #FFFFFF   /* карточки, панели, модалки */
--border:     #E4E4E9   /* разделители, рамки */

--primary:    #4A6FA5   /* основные кнопки, ссылки */
--primary-h:  #3A5A8A   /* hover состояние primary */
--primary-bg: #EEF3FA   /* мягкий фон для secondary-кнопок */

--success:    #4CAF82   /* правильный ответ, Easy */
--warning:    #E8A24A   /* Hard, предупреждения */
--danger:     #E05C5C   /* Again, удаление */
--info:       #4A6FA5   /* Good (совпадает с primary) */

--text:       #1C1C2E   /* основной текст */
--muted:      #6B6B80   /* подписи, вторичный текст */
--disabled:   #B0B0BC   /* неактивные элементы */
```

**Правило:** не использовать более 2 цветов-акцентов на одном экране.

---

## Типографика

```
font-family: 'Inter', system-ui, sans-serif
```

| Роль | Размер | Вес |
|---|---|---|
| h1 (заголовок страницы) | 28px | 700 |
| h2 (секция) | 22px | 600 |
| h3 (подзаголовок) | 18px | 600 |
| body | 16px | 400 |
| small / метка | 14px | 400 |
| word-large (слово на карточке) | 32px | 700 |
| caption | 12px | 400 |

Line-height: `1.5` для текста, `1.2` для крупных слов.

---

## Отступы

Базовая единица: `4px`.
Шкала: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`

- Внутренние отступы карточек: `24px`
- Между элементами списка: `12px`
- Между секциями страницы: `32px`
- Горизонтальные поля страницы: `24px` (mobile), `48px` (desktop)

---

## Скругления

| Элемент | Радиус |
|---|---|
| Кнопки | 8px |
| Карточки, панели | 12px |
| Модалки | 16px |
| Letter tile | 8px |
| Badge / тег | 20px (pill) |
| Input | 8px |

---

## Тени

```
--shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.06);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.10);
```

Использовать только `--shadow-md` для карточек и `--shadow-sm` для кнопок в состоянии hover.
Не накладывать тени поверх теней.

---

## Компоненты

### Кнопки

**Primary**
- bg: `--primary`, текст: white
- height: 40px, padding: `0 20px`
- hover: bg `--primary-h`
- border-radius: 8px

**Secondary**
- bg: `--primary-bg`, текст: `--primary`, border: 1px `--primary` (20% opacity)
- Те же размеры

**Danger**
- bg: `--danger`, текст: white

**Ghost**
- bg: transparent, текст: `--muted`
- hover: bg `--border`

**Disabled (все типы)**
- opacity: 0.45, cursor: not-allowed

### Anki-кнопки (Flashcard / оценка)

| Кнопка | Цвет bg | Цвет текста |
|---|---|---|
| Снова | `--danger` | white |
| Сложно | `--warning` | white |
| Хорошо | `--primary` | white |
| Легко | `--success` | white |

Размер: min-width 80px, height 44px. Отображать под подсказкой `(пробел = Хорошо)`.

### Flashcard

- Размер: max-width 480px, min-height 240px, centered
- Слово: 32px 700, по центру карточки
- Flip-анимация: CSS `rotateY(180deg)`, 300ms ease
- Лицо: слово, изнанка: перевод + транскрипция (если есть)
- После переворота — показывать Anki-кнопки

### Letter tile (Writing)

- Размер: 44×44px
- bg: `--surface`, border: 1px `--border`
- hover: border `--primary`, bg `--primary-bg`
- selected/used: bg `--border`, текст `--disabled`, pointer-events: none
- radius: 8px, font: 18px 600

### Input

- height: 40px, padding: `0 12px`
- border: 1px `--border`, radius: 8px, bg: `--surface`
- focus: border `--primary`, outline none, `box-shadow: 0 0 0 3px rgba(74,111,165,0.15)`

### Card (контейнер)

- bg: `--surface`, border: 1px `--border`
- padding: 24px, radius: 12px, shadow: `--shadow-md`

### Badge (состояние карточки)

| Состояние | Цвет |
|---|---|
| new | `--primary` |
| learning | `--warning` |
| review | `--success` |

---

## Иконки

Использовать **Lucide React** — stroke-based, 20px, stroke-width 1.75.
Не смешивать с другими наборами.

---

## Запреты

- Не использовать градиенты на кнопках и фонах
- Не делать тени многослойными
- Не менять border-radius произвольно
- Не использовать более 2 акцентных цветов на экране
- Не добавлять анимации дольше 350ms
- Не использовать capitalize/uppercase на немецких словах (нарушает правила языка)
