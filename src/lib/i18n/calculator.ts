// Strings for the calculator's way in (its button, the Tools menu, the
// non-calculator note): all a page carries until the calculator is opened.
// The calculator's own strings are in calculator-panel.ts, loaded with it.
// Other locales fall back to English.

import { registerTranslations } from "@/lib/i18n";

registerTranslations(
  {
    "calc.title": "Calculator",
    "calc.tools": "Tools",
    "calc.shortcut": "Alt+C",
    "calc.nonCalculator": "This paper is non-calculator",
  },
  {},
);
