/**
 * Shared landing page button styles — two tiers only (primary gold, secondary neutral).
 */

export const landingPrimaryClass =
  "inline-flex items-center justify-center rounded-xl bg-dawg-500 hover:bg-dawg-400 text-void-950 font-semibold px-8 py-3 transition-colors";

/** Primary + sweep (hero only). */
export const landingPrimaryHeroClass = `${landingPrimaryClass} shine-sweep`;

export const landingSecondaryClass =
  "inline-flex items-center justify-center rounded-xl border border-void-600 bg-void-850/50 text-void-200 hover:border-dawg-500/35 hover:text-void-100 font-semibold px-8 py-3 transition-colors";
