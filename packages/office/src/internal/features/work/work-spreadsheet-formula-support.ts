import { spreadsheetFormulaFunctions } from './work-spreadsheet-formulas';

type FortuneLocale = typeof import('@fortune-sheet/core').locale;

let supportedFunctions: Set<string> | undefined;
let loadingSupport: Promise<void> | undefined;

/** Fortune's locale table is large. Operator-only formulas never load it. */
export function ensureSpreadsheetFormulaSupport(): Promise<void> {
  if (supportedFunctions) return Promise.resolve();
  loadingSupport ??= import('@fortune-sheet/core').then(({ locale }) => {
    supportedFunctions = new Set(
      locale({ lang: 'en' } as Parameters<FortuneLocale>[0]).functionlist.map(
        (item) => item.n.toUpperCase(),
      ),
    );
  });
  return loadingSupport;
}

export function unsupportedSpreadsheetFormulaFunctions(
  formula: string,
): string[] {
  const names = spreadsheetFormulaFunctions(formula);
  if (!names.length || !supportedFunctions) return [];
  return names.filter((name) => !supportedFunctions?.has(name));
}
