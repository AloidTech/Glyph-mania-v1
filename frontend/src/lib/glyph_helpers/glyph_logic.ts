/**
 * @file glyph_logic.ts
 * @description Façade & backward-compatibility bridge for Glyph systems.
 *
 * NOTE: This file re-exports specialized modules to maintain full backward compatibility:
 * - `glyph_solidity.ts`: Validation rules, solidity checks, and composition extraction.
 * - `glyph_runtime.ts`: In-game scene inventory, instance placement, and cast activation.
 *
 * For new code, prefer importing directly from the specialized module:
 *   import { isSolid, checkSolidityFromAnalysis } from './glyph_solidity';
 *   import { placeOrActivate, activate } from './glyph_runtime';
 */

export * from './glyph_solidity';
export * from './glyph_runtime';
export * from './glyph_canvas_loader';
