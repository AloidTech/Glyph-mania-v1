# Project Memory & Behavioral Guidelines

## 1. Phosphor Icon Imports
ALWAYS import icons from `@phosphor-icons/react` using their direct `*Icon` export name without `as` aliasing.
- **Correct**:
  ```ts
  import {
    PenIcon,
    EraserIcon,
    ArrowArcLeftIcon,
    ArrowArcRightIcon,
    TrashIcon,
    ScrollIcon,
    CaretUpIcon,
    CaretDownIcon,
    CaretLeftIcon,
    CaretRightIcon,
    PlusIcon,
    SparkleIcon,
  } from '@phosphor-icons/react';
  ```
- **Incorrect**:
  ```ts
  import { Pen as PenIcon, Eraser as EraserIcon } from '@phosphor-icons/react';
  ```

## 2. Drawing Canvas & Atrament Architecture
- All sketchpad / drawing canvas components must use Atrament via the unified `DrawingCanvas` component.
- `DrawingCanvas` is the single source of truth for:
  - Workshop canvas (`WorkshopSceneUi.tsx`)
  - Testing Grounds mini drawing pad (`MiniDrawingPad.tsx`)
  - Admin training & creation canvases (`SigilTrainingPage.tsx`, `SigilCreatePage.tsx`, `GlyphTestingPage.tsx`)
- Configurable features:
  - Resizable dimensions (`width`, `height`, responsive layout)
  - Repositionable toolbar (`toolbarPosition`: `'top' | 'left' | 'right' | 'bottom' | 'none'`, `toolbarOrientation`: `'horizontal' | 'vertical'`)
  - Cardinal arrow guidelines (`showGuide: boolean`)
  - Background customization (`backgroundImage`, `backgroundColor`)
  - Smoothness control (`smoothing`, `adaptiveStroke`)

## 3. Database Schema & Type Syncing
- Supabase Project Ref: `ugnrkoczkfosayycfslt`
- Sigils & Glyphs use `cover_asset` for visual preview/texture references.
- Auto-generate types using `npm run db:types`.
