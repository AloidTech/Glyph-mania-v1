# Phosphor Icon Import Standards

## CRITICAL RULE: NEVER Import with "as" Aliasing
Always import icons from `@phosphor-icons/react` using their direct, official `*Icon` export name.

### Correct Examples:
```typescript
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
  XIcon,
  HouseIcon,
  ArrowLeftIcon,
} from '@phosphor-icons/react';
```

### Prohibited Examples:
```typescript
// NEVER DO THIS:
import {
  Pen as PenIcon,
  Eraser as EraserIcon,
  ArrowArcLeft as ArrowArcLeftIcon,
  ArrowArcRight as ArrowArcRightIcon,
  Trash as TrashIcon,
  Scroll as ScrollIcon,
  CaretUp as CaretUpIcon,
} from '@phosphor-icons/react';
```
