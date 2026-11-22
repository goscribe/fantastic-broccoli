// Strings for the voice scribe (talk to write). Imported for side effect by
// the components that use these keys. Other locales fall back to English.

import { registerTranslations } from "@/lib/i18n";

const english = {
  "voice.open": "Talk to write",
  "voice.title": "Talk to write",
  "voice.stopAndWrite": "Stop and write it in",
  "voice.resume": "Keep talking",
  "voice.listening": "Listening…",
  "voice.hearing": "Hearing you…",
  "voice.writing": "Writing…",
  "voice.paused": "Paused",
  "voice.into": "Into answer {box}",
  "voice.hint": "Say your working out loud — “add the oranges to the bananas” — and Scribe writes 2 + 2 = 4.",
  "voice.tip": "Stop to put it in the answer box. Say “scratch that” to undo.",
  "voice.tipPaused": "Tap ✓ to put it in the answer box.",
  "voice.crossedOut": "↩ Crossed out step {n}",
  "voice.noAnswerBox": "No answer box here",
  "voice.cancel": "Cancel",
  "voice.undo": "Undo",
  "voice.addedOne": "Added 1 line to answer {box}",
  "voice.addedMany": "Added {n} lines to answer {box}",
  "voice.copiedNoBox": "No answer box here, so your working was copied.",
  "voice.unsupported": "This browser can't listen. Try Chrome or Safari.",
  "voice.denied": "Scribe needs the microphone. Allow it in your browser settings and try again.",
  "voice.failed": "Listening stopped. Tap the mic to try again.",
  "voice.asSpoken": "Couldn't tidy that up, so it's written as you said it.",
};

registerTranslations(english, {});
