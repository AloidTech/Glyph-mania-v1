import { useState, useCallback, useMemo } from 'react';
import {
  analyzeGlyphComposition,
  GlyphCompositionAnalysis,
} from '../ml/glyph_semantic_engine';
import {
  checkSolidityFromAnalysis,
  getCanvasSigilErrors,
  CanvasSigilError,
  SolidityAnalysis,
  defaultResolveSigilId,
} from '../glyph_helpers/glyph_solidity';
import type { AdminSigilItem } from '../stores/admin_sigils_store';
import type { Sigil } from '../../types/glyph_types';

export interface UseGlyphDiagnosticsReturn {
  analysis: GlyphCompositionAnalysis | null;
  solidity: SolidityAnalysis | null;
  canvasSigilErrors: CanvasSigilError[];
  dismissedErrors: Record<string, boolean>;
  isAnalyzing: boolean;
  sessionId: number;
  analyzeCanvas: (
    canvas: HTMLCanvasElement,
    sigils: (AdminSigilItem | Sigil)[],
    resolveSigilId?: (label?: string | null) => string | undefined
  ) => Promise<{
    analysis: GlyphCompositionAnalysis;
    solidity: SolidityAnalysis;
    errors: CanvasSigilError[];
  }>;
  dismissError: (key: string) => void;
  resetDismissed: () => void;
  clearDiagnostics: () => void;
}

export function useGlyphDiagnostics(): UseGlyphDiagnosticsReturn {
  const [analysis, setAnalysis] = useState<GlyphCompositionAnalysis | null>(null);
  const [solidity, setSolidity] = useState<SolidityAnalysis | null>(null);
  const [dismissedErrors, setDismissedErrors] = useState<Record<string, boolean>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState(1);

  const canvasSigilErrors = useMemo(() => {
    return getCanvasSigilErrors(analysis, solidity);
  }, [analysis, solidity]);

  const analyzeCanvas = useCallback(
    async (
      canvas: HTMLCanvasElement,
      sigils: (AdminSigilItem | Sigil)[],
      resolveSigilId?: (label?: string | null) => string | undefined
    ) => {
      setIsAnalyzing(true);
      try {
        const result = await analyzeGlyphComposition(canvas);
        const resolver = resolveSigilId || ((label?: string | null) => {
          return defaultResolveSigilId(label, sigils);
        });

        const solidityResult = checkSolidityFromAnalysis(result, sigils, resolver);
        const errors = getCanvasSigilErrors(result, solidityResult);

        setAnalysis(result);
        setSolidity(solidityResult);
        setSessionId((prev) => prev + 1);
        setDismissedErrors({});

        return {
          analysis: result,
          solidity: solidityResult,
          errors,
        };
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const dismissError = useCallback((key: string) => {
    setDismissedErrors((prev) => ({ ...prev, [key]: true }));
  }, []);

  const resetDismissed = useCallback(() => {
    setDismissedErrors({});
  }, []);

  const clearDiagnostics = useCallback(() => {
    setAnalysis(null);
    setSolidity(null);
    setDismissedErrors({});
    setSessionId((prev) => prev + 1);
  }, []);

  return {
    analysis,
    solidity,
    canvasSigilErrors,
    dismissedErrors,
    isAnalyzing,
    sessionId,
    analyzeCanvas,
    dismissError,
    resetDismissed,
    clearDiagnostics,
  };
}
