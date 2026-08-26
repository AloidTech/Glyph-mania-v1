# Design System & Architecture Rules

## General Architecture & Philosophy
You are building a highly modular, scalable, and maintainable user interface. The architecture must prioritize reusability, keeping file sizes small, and separating concerns. Every UI element should be constructed from atomic, modular components rather than large, monolithic files.

## Modular Component Structure
- **Component Modularity:** Break down all layouts, sections, and features into the smallest reasonable, reusable React components.
- **Separation of Concerns:** Keep helper functions, types, and constants in their own dedicated files.
- **Reusability:** Build components in a way that allows them to be easily reused across different contexts without needing to rewrite logic or styling.

## Global & Default Styling
- **Comprehensive Typography Base:** Define strict, global default styles for all typography elements (`h1`, `h2`, `h3`, `p`, etc.) at the root level. All text throughout the application must inherit from these carefully defined typography scales.
- **Text Variants:** Create custom, reusable styling classes or components for specific text types (e.g., "subtitle", "caption", "lead") to ensure complete consistency across the app.
- **Container Styles:** Define custom, reusable styles for different types of containers (e.g., "card", "section-wrapper", "page-container"). Do not use one-off inline layout styles; rely on these standardized container definitions to handle padding, margins, and constraints.
- **Button System:** Establish a robust button styling system with distinct, reusable variants (e.g., primary, secondary, tertiary, ghost, destructive). All interactive buttons must pull from this standardized set.

## Layout & Composition
- Opt for responsive and well-structured layouts that use CSS `flexbox` and `grid` by default.
- Only use absolute positioning when absolutely necessary for specific decorative overlaps or floating UI elements.
- Maintain consistent whitespace and rhythm by relying on global spacing tokens or variables rather than arbitrary pixel values.

## Iconography
- **Phosphor Icons:** Always use Phosphor Icons (`@phosphor-icons/react`) for all iconography needs. Ensure icon weights, sizes, and styles remain consistent throughout the UI. Do not use Lucide or other icon libraries unless specifically asked.

## Refactoring & Code Quality
- Refactor code as you go to keep the codebase exceptionally clean.
- If a component grows too large or handles too many responsibilities, immediately abstract it into smaller sub-components.

## Additional Styling Constraints
- **No gradients** unless the user explicitly requests one or provides a reference containing a gradient.
- **Vanilla CSS only** — do not use Tailwind CSS or any utility-first CSS framework.
