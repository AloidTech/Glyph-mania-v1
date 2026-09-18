# GLYPH MANIA — Admin Studio Design Specification
> **Document Purpose:** Comprehensive UI/UX design specification and prompt guide for generating the Glyph Mania Admin Studio interface in **Figma Make** / **Figma AI**.

---

## 1. Executive Summary & Design Vision

### 1.1 The Product
**Glyph Mania** is an arcane spellcrafting game where players draw magical runes on parchment to invoke elemental spells. 
The **Admin Studio** is the behind-the-scenes laboratory where designers and machine learning engineers:
1. Register and define core **Arcane Sigils** (individual runes: Effectors & Augmentors).
2. Collect drawing exemplars and train on-device **TensorFlow.js ML classifiers** to recognize player brushstrokes.
3. Construct and catalog multi-rune composite **Glyphs** (spells with center effectors + cardinal and corner augmentors).
4. Run real-time recognition diagnostics in the **Glyph Testing Studio**.

### 1.2 Aesthetic Theme: "Arcane Scholarly Atelier"
- **Art Direction:** Inspired by *Witch Hat Atelier*, renaissance alchemical manuscripts, and classical botanical/architectural notebooks.
- **Atmosphere:** Warm antique parchment paper, deep carbon/calligraphic ink typography, gilded arcane gold accents, and crisp structural borders.
- **Anti-Patterns:** Avoid generic dark neon SaaS dashboards, flat corporate blues, floating purple gradients, or heavy multi-colored glowing drop shadows.

---

## 2. Design Tokens & Visual Language

### 2.1 Color Palette
Use these exact hex codes and semantic tokens in Figma:

| Token Name | Hex / Value | Purpose |
| :--- | :--- | :--- |
| `admin-bg` | `#F6F4EE` | Studio background behind panels |
| `admin-paper` | `#FFFFFF` | Primary card & panel background |
| `admin-paper-warm` | `#FAF8F3` | Warm parchment tint for canvas / preview wells |
| `admin-paper-muted` | `#F0ECE1` | Muted secondary containers & input backgrounds |
| `admin-ink` | `#1B1F23` | Primary headings, titles, high-contrast text |
| `admin-ink-secondary`| `#4A5568` | Body copy, secondary labels, metadata |
| `admin-ink-muted` | `#718096` | Placeholders, timestamps, disabled indicators |
| `admin-border` | `#E2DCD2` | Primary hairline border for cards & panels |
| `admin-border-strong`| `#C8C0B2` | Focus states, active borders, dividers |
| `admin-accent` (Gold) | `#C9A227` | Primary CTA buttons, golden highlights, active states |
| `admin-accent-hover`| `#B08D1F` | CTA button hover state |
| `admin-accent-subtle`| `rgba(201, 162, 39, 0.12)` | Notification tint, selected row background |
| `admin-danger` (Red) | `#C53030` | Destructive actions, delete buttons |
| `admin-danger-paper` | `#FFF5F5` | Background for unsaved change badges |
| `admin-danger-border`| `#FEB2B2` | Border for unsaved change badges |
| `color-destructive` | `#8A3028` | Deep cinnabar ink for unsaved badge icons |
| `admin-success` | `#2F855A` | Sufficient training exemplar badges, match score |
| `admin-success-subtle`| `rgba(47, 133, 90, 0.1)`| Background for success / high-confidence pills |

#### Elemental Colors
- **Fire:** `#E25822` (Flame Terracotta)
- **Water:** `#3182CE` (Cerulean Tide)
- **Earth:** `#38A169` (Verdant Jade)
- **Air:** `#805AD5` (Gale Violet)

### 2.2 Typography Scale
- **Display & Headings:** `Cinzel` (Classical Roman Antiqua serif)
  - Page Title: `Cinzel Bold`, 24px–28px, Letter-spacing `0.04em`, Upper-case
  - Section Title: `Cinzel SemiBold`, 18px–20px
  - Card Title: `Cinzel Bold`, 16px–18px
- **Body & Content:** `Crimson Pro` (Editorial humanist serif)
  - Body Regular: `Crimson Pro Regular`, 14px–16px, Line-height `1.5`
  - Secondary/Caption: `Crimson Pro Regular`, 12px–13px
- **Technical & Metrics:** `JetBrains Mono` (Monospaced)
  - Code, IDs, Epoch counts, Loss percentages: `12px–13px`, Regular / Bold

### 2.3 Radii & Shadows
- **Border Radius:**
  - `radius-sm`: `4px` (buttons, badges, inputs, preview boxes)
  - `radius-md`: `8px` (panels, cards)
  - `radius-full`: `9999px` (circular status jewel badges, filter pills)
- **Elevation / Shadows:**
  - Minimal tactile elevation: `0 1px 3px rgba(44, 40, 38, 0.08)`
  - Elevated modal / drawer: `0 8px 24px rgba(44, 40, 38, 0.12)`
  - Card hover lift: `translateY(-2px)`, shadow `0 4px 12px rgba(44, 40, 38, 0.08)`

---

## 3. Global Layout Architecture

```
+-------------------------------------------------------------------------------+
| TOP NAVBAR (Sticky, 56px height)                                              |
| [Sparkle Icon] GLYPH MANIA — ADMIN STUDIO      [Sigils] [Glyphs] [Testing] [⌂]|
+-------------------------------------------------------------------------------+
| NOTIFICATION BANNER (Conditional, Warm Gold Tint)                             |
| [!] You have 12 new examples since last training.  [Go train the model ->]   |
+-------------------------------------------------------------------------------+
| MAIN CONTENT AREA (Max-width 1280px, centered, padding: 32px 24px)            |
|                                                                               |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### 3.1 Top Navigation Bar (`AdminNavBar`)
- **Container:** Full width, background `var(--admin-paper)`, border bottom `1px solid var(--admin-border)`.
- **Left:** Brand link with `<Sparkle>` icon (Arcane Gold) and text `"GLYPH MANIA — ADMIN STUDIO"` in `Cinzel Bold` 14px.
- **Right Navigation Group:**
  - **Sigils Catalog:** Button pill with `<Compass>` icon. Active state: Solid Gold background (`#C9A227`), white text.
  - **Glyphs Catalog:** Button pill with `<DiamondsFour>` icon.
  - **Glyph Testing:** Button pill with `<Crosshair>` icon.
  - **Back to Game:** Compact square icon-only button (36x34px) with `<House>` icon.

### 3.2 Untrained Exemplars Banner (`AdminLayout`)
- Shown whenever local exemplars have been drawn but not yet baked into the model weights.
- Background: Soft gold wash (`rgba(201, 162, 39, 0.12)`), text: dark ink, alert icon.
- Direct link to jump directly into the training tab.

---

## 4. Screen-by-Screen Specifications

### SCREEN 1: Arcane Sigils Catalog (`SigilsListPage`)
*The directory of all atomic runes in the magic system.*

#### 1. Page Header Area
- **Title:** `"Arcane Sigils Catalog"` (Cinzel Bold, 26px)
- **Subtitle:** `"Manage your registered sigils, cover graphics, definitions, and ML training exemplars."` (Crimson Pro, 15px)
- **Action Button (Top Right):** `+ Create New Sigil` (Primary gold button with `<Plus>` icon).

#### 2. Filter & Search Toolbar
- **Container:** White panel, border `1px solid var(--admin-border)`, padding `14px 20px`, horizontal flexbox.
- **Left - Segmented Type Selector:**
  - Toggle group with pills: `All (18)`, `Effectors (6)`, `Augmentors (12)`.
  - Active pill: Dark ink background (`#1B1F23`), white text.
  - Inactive pills: Transparent background, dark ink text on hover.
- **Right - Search Field:**
  - Input with magnifying glass icon, placeholder `"Search sigils by name, description, or ID..."`, width `320px`.

#### 3. Sigils Card Grid
- Layout: Responsive CSS grid (3 to 4 columns, gap `20px`).
- **Each Sigil Card (`.sigil-card`):**
  - **Border & Background:** White paper (`#FFFFFF`), `1px solid var(--admin-border)`, radius `8px`, overflow hidden.
  - **Upper Preview Box (`.sigil-card-preview`):**
    - Aspect ratio `1:1`. Background: Warm paper tint (`#FAF8F3`).
    - **Top-Left Badge:** Floating Exemplar Count (`<Brain>` icon + `"36 examples"`). Color-coded:
      - Green (`admin-badge-success`) if count >= 5.
      - Amber (`admin-badge-warning`) if 1–4 examples.
      - Gray (`admin-badge-neutral`) if 0 examples.
    - **Top-Right Badge (Status Jewel):**
      - Rendered only if card has uncommitted local changes (`drafts[id]`).
      - Compact circular jewel (24x24px, radius 50%).
      - Background: Pale ruby wash (`#FFF5F5`), border `1.5px solid #FEB2B2`, icon: `<FloppyDisk weight="fill">` in deep cinnabar red (`#8A3028`).
    - **Center Graphic:** Vector SVG / rendered rune graphic, centered, max width/height `80px`.
  - **Content Body:**
    - Title row: Sigil Label (Cinzel Bold, 16px) + Type pill (e.g. `Effector · fire` in soft orange or `Augmentor · form` in soft parchment).
    - Description: 2-line truncated editorial text (Crimson Pro, 13px, color `var(--admin-ink-secondary)`).
  - **Card Footer:**
    - Action bar with two buttons:
      - `[Edit]` button (Secondary outline, `<Sliders>` icon).
      - `[Train]` button (Primary gold, `<Brain>` icon).

---

### SCREEN 2: Sigil Detail & Editor (`SigilDetailPage`)
*Inspect and edit a single rune's metadata, asset path, and configuration.*

#### 1. Header & Navigation
- Breadcrumb link: `<- Back to Catalog`.
- Title: Sigil Label + Unsaved status pill (if edited).
- Top Right Actions: `[Cancel Changes]` and `[Save to Database]` (Primary gold CTA).

#### 2. Two-Column Layout (35% Left / 65% Right)
- **Left Column: Graphic Asset & Preview:**
  - Large square canvas preview container (260x260px, warm paper background, border).
  - SVG asset selector / upload field.
  - Sample presets picker (Fire Effector, Water Effector, Earth Effector, Spiral Form, etc.).
- **Right Column: Rune Definition Form:**
  - **Sigil Label:** Text input (e.g., `"Water"` or `"Spiral"`).
  - **Classification Type:** Dropdown or segmented radio (`Effector` vs `Augmentor`).
  - **Subtype / Element:**
    - If Effector: Element picker (`Fire`, `Water`, `Earth`, `Air`, `Arcane`).
    - If Augmentor: Category picker (`Form`, `Direction`, `Power`).
  - **Tier Level:** Numeric stepper or tier pill selector (`Tier 1`, `Tier 2`, `Tier 3`).
  - **Description:** Multi-line textarea for spell lore and gameplay function.
  - **Bottom Panel:** Training shortcut card displaying current exemplar count and button: `"Open Training Studio for this Sigil ->"`.

---

### SCREEN 3: Sigil Machine Learning Training Studio (`SigilTrainingPage`)
*The interactive drawing lab where neural network models are trained on real player brushstrokes.*

#### 1. Top Header & Tab Switcher
- Header: Rune title, current training status, and tabs:
  - Tab 1: **"Draw & Collect Exemplars"**
  - Tab 2: **"Train & Evaluate Model"**
  - Tab 3: **"Model Checkpoints & Weights"**

#### 2. Tab 1: Interactive Drawing & Dataset Collector
- **Drawing Canvas Well:**
  - Centered square canvas (400x400px, warm paper `#FFFCF8`, inset shadow).
  - Guide marks (subtle dotted center crosshair and boundary guide).
  - **Floating Atelier Toolbar:**
    - Vertical or horizontal floating pill palette.
    - Tools: Brush (with stroke width slider), Eraser, Clear Canvas (`<Trash>`), Undo (`<ArrowCounterClockwise>`).
- **Exemplar Capture Controls:**
  - Big CTA: `[Record Exemplar]` (Hot-key `Space`).
  - Progress indicator: e.g. `"42 / 50 recommended exemplars collected"`.
- **Exemplars Strip / Gallery:**
  - Horizontal scrolling filmstrip or bottom panel showing all drawn thumbnail strokes for this rune.
  - Hover on thumbnail reveals `[Delete]` button and full-screen inspection trigger.

#### 3. Tab 2: Model Training & Diagnostics Panel
- **Training Hyperparameters Card:**
  - Inputs for: Epochs (default `50`), Batch Size (`16`), Learning Rate (`0.001`).
  - Button: `[Start Neural Network Training]` (with spinning arcane indicator during training).
- **Live Metrics Dashboard:**
  - Real-time loss graph and validation accuracy chart.
  - Final classification accuracy gauge (e.g. `98.4% Accuracy`).
  - Confusion matrix / recognized stroke confidence readout.

---

### SCREEN 4: Composite Glyphs Catalog (`GlyphsListPage`)
*The catalog of complex multi-part spells created by combining sigils.*

#### 1. Page Header & Element Filter Bar
- Header: `"Composite Glyphs Catalog"`.
- Segmented pills: `All`, `Fire`, `Water`, `Earth`, `Air`.
- Search box for glyph names or component keywords.

#### 2. Composite Glyph Card Layout
- **Upper Preview Box:**
  - Radial composition diagram: Center circle (Effector) surrounded by 4 cardinal nodes (Direction augmentors) and 4 diagonal nodes (Form augmentors).
  - Top-Left: Confidence Score match badge (`<Sparkle>` icon + `"98% Match"`).
  - Top-Right: Unsaved Changes Jewel badge (`<FloppyDisk>` in ruby red).
- **Body Info:**
  - Spell Title (e.g., `"Inferno Vortex Glyph"`).
  - Center Effector pill (e.g., `Effector · Fire`).
  - Component tags: pills showing active directions (`Top`, `Bottom`) and active forms (`Condense`, `Spiral`).
- **Footer Actions:** `[Edit Details]`, `[Test in Studio]`.

---

### SCREEN 5: Glyph Testing & Spell Recognition Studio (`GlyphTestingPage`)
*Live diagnostics studio where a user draws full spell circles and watches the multi-stage detection engine decode it in real time.*

#### 1. Studio Layout (Two Halves / Split Screen)
- **Left Side: Live Spell Drawing Board:**
  - 500x500px drawing board simulating the player's in-game parchment.
  - Floating brush/clear toolbar.
  - Real-time detection toggle: `"Live Detection Engine (Active)"`.

#### 2. Right Side: Multi-Stage Recognition Inspector
- **Diagnostic Step 1: Center Effector Detection**
  - Isolates center strokes, displays detected core element (`Water`, 99.2% confidence).
- **Diagnostic Step 2: Radial Augmentor Mapping**
  - Interactive 8-directional visual diagram showing which strokes mapped to which cardinal/corner slots.
- **Diagnostic Step 3: Resolved Spell Payload**
  - Spell Name matched: `"Tidal Barrier Glyph"`.
  - Raw JSON inspection drawer with bounding boxes and stroke geometry.
- **Action Button:** `[Save as New Master Glyph]` if an unrecognized formation was drawn.

---

## 5. Reusable Component Inventory for Figma

When constructing the UI Kit in Figma, generate the following components:

### 1. Buttons (`.admin-btn`)
- **Primary:** Background `#C9A227` (Arcane Gold), text `#FFFFFF` (Cinzel 13px Bold), border radius `4px`, padding `8px 16px`. Hover: `#B08D1F`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#1B1F23`, border `1px solid #E2DCD2`. Hover: background `#F6F4EE`.
- **Danger:** Background `#FFF5F5`, text `#C53030`, border `1px solid #FEB2B2`. Hover: background `#FED7D7`.
- **Icon-Only:** 36x34px square, centered icon.

### 2. Segmented Pill Controls (`.admin-segmented`)
- Outer container: Background `#F0ECE1`, border `1px solid #E2DCD2`, radius `6px`, padding `3px`, horizontal auto-layout.
- Segment item: Radius `4px`, padding `6px 14px`, text 13px Cinzel.
  - Active: Background `#1B1F23` (Dark Ink), text `#FFFFFF`, shadow `0 1px 3px rgba(0,0,0,0.1)`.
  - Inactive: Background transparent, text `#4A5568`.

### 3. Status Badges & Jewels
- **Exemplar Count Badge:** Radius `4px`, padding `3px 8px`, icon 12px, font 11px uppercase bold.
  - Success: Bg `rgba(47, 133, 90, 0.1)`, Text `#2F855A`, Border none.
  - Warning: Bg `#FFFBEB`, Text `#B45309`, Border none.
- **Status Jewel Badge (`.admin-card-status-badge`):**
  - Dimensions: `24px x 24px` circular (radius `50%`).
  - Unsaved / Draft: Background `var(--admin-danger-paper)` (`#FFF5F5`), border `1.5px solid var(--admin-danger-border)` (`#FEB2B2`), icon `<FloppyDisk weight="fill">` in `#8A3028`.
  - Drop shadow: minimal `0 1px 3px rgba(0,0,0,0.08)`.

### 4. Admin Cards (`.sigil-card`)
- Width: `280px–320px`, vertical auto-layout.
- Border: `1px solid #E2DCD2`, radius `8px`, background `#FFFFFF`.
- Header Preview Well: Height `180px`–`200px`, background `#FAF8F3`, border bottom `1px solid #E2DCD2`.
- Content padding: `16px`, gap `8px`.
- Footer padding: `12px 16px`, border top `1px solid #E2DCD2`, background `#FAF8F3`.

---

## 6. Ready-to-Use Prompts for Figma Make / Figma AI

You can copy and paste the following prompt blocks directly into Figma Make:

### Master Prompt for Complete Admin Studio
```text
Create a high-fidelity web app UI for "Glyph Mania — Admin Studio", a magical runes and machine learning design laboratory. 
Aesthetic: Witch Hat Atelier style scholarly atelier. Warm antique paper (#F6F4EE, #FAF8F3, #FFFFFF), deep carbon calligraphy ink (#1B1F23, #4A5568), golden arcane accents (#C9A227), and tactile borders (#E2DCD2). Headings in Cinzel serif, body in Crimson Pro serif, metrics in JetBrains Mono.

Include:
1. Sticky top navigation bar: Brand logo with golden sparkle icon "GLYPH MANIA — ADMIN STUDIO", navigation buttons for "Sigils Catalog" (active gold), "Glyphs Catalog", "Glyph Testing", and a house icon for "Back to Game".
2. Alert banner: Warm gold background with warning icon: "You have 12 new examples since your last training. Go train the model ->".
3. Main Sigils Catalog page:
   - Header with title "Arcane Sigils Catalog", subtitle, and "+ Create New Sigil" gold CTA button.
   - Filter bar: Segmented pill controls for "All (18)", "Effectors (6)", "Augmentors (12)", and a 320px search input on the right.
   - Responsive grid of rune cards: Each card has a square warm-paper preview well showing a hand-drawn black ink rune (e.g. Water waves, Fire flame, Spiral), a top-left green badge "36 examples", a top-right circular 24px ruby-red jewel badge with a floppy disk save icon for unsaved drafts. Below the preview: Rune label in Cinzel Bold, category pill "Effector · water", 2-line description in Crimson Pro, and a footer with "Edit" outline button and "Train" gold button.
```

### Prompt for ML Training Studio Screen
```text
Create a desktop UI screen for the "Sigil ML Training Studio" in Glyph Mania. 
Warm parchment and antique atelier aesthetic (#F6F4EE, #FAF8F3, #1B1F23, #C9A227, #E2DCD2). Cinzel serif headings, Crimson Pro body.

Layout:
- Top bar with back link, rune title "Water Effector — ML Training Studio", and tabs: "Draw & Collect Exemplars" (active), "Train Model", "Saved Weights".
- Left side: A 420x420px square drawing canvas well with light cream background (#FFFCF8) and faint crosshair guides. Next to it is a floating wooden atelier toolbar with Brush, Eraser, Clear, and Undo tools. Under the canvas: a large gold button "[ Record Exemplar (Space) ]" and count "42 / 50 Exemplars".
- Right side: Dataset filmstrip panel showing a grid of 40 small 70x70px thumbnail cards of previously drawn water rune strokes, each with a subtle delete icon on hover.
- Bottom status bar showing model training status and accuracy badge.
```

### Prompt for Glyph Testing & Diagnostic Screen
```text
Create a high-fidelity split-screen interface for "Glyph Testing Studio".
Scholarly alchemy theme with light warm parchment paper (#FAF8F3, #FFFFFF), deep dark ink typography, and gold highlights (#C9A227).

Left side (50%):
- Large 480x480px interactive drawing canvas where a complex circular spell is drawn with a center water effector and cardinal arrows. Floating toolbar on top.

Right side (50%):
- Real-time spell recognition diagnostic panel:
  1. "Center Effector": Detected as "Water" with 99.4% confidence gauge.
  2. "Radial Slot Visualizer": An 8-spoke circular diagram showing which strokes mapped to Top, Right, Bottom, Left, and diagonals.
  3. "Matched Spell": Card with title "Tidal Barrier Glyph", Tier 2, and elemental preview.
  4. Raw JSON readout box in monospaced font with detected stroke coordinates.
  5. Action buttons: "Reset Canvas" and "Save as Master Spell".
```
