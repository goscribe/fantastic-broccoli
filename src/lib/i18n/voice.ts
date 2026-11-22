// Strings for the voice scribe (talk to write). Imported for side effect by
// the components that use these keys. Other locales fall back to English.

import { registerTranslations } from "@/lib/i18n";

const english = {
  "voice.open": "Talk to write",
  "voice.title": "Talk to write",
  "voice.close": "Close",
  "voice.toNotepad": "Notepad",
  "voice.toAnswer": "Answer box",
  "voice.start": "Start talking",
  "voice.stop": "Stop",
  "voice.listening": "Listening…",
  "voice.writing": "Writing…",
  "voice.hint": "Say your working out loud — “add the oranges to the bananas” — and Scribe writes 2 + 2 = 4.",
  "voice.commands": "Say “scratch that” to undo, “new line” to start a line.",
  "voice.notepadLabel": "Notepad",
  "voice.notepadPlaceholder": "Your working appears here.",
  "voice.answerHint": "Tap an answer box to choose where your words go.",
  "voice.noAnswerBox": "There's no answer box on this question. Your words go to the notepad.",
  "voice.answerEmpty": "Nothing in this box yet.",
  "voice.undo": "Undo",
  "voice.clear": "Clear",
  "voice.toAnswerBox": "Put in answer box",
  "voice.copied": "Added to the answer box",
  "voice.unsupported": "This browser can't listen. Try Chrome or Safari.",
  "voice.denied": "Scribe needs the microphone. Allow it in your browser settings and try again.",
  "voice.failed": "Listening stopped. Tap Start talking to try again.",
  "voice.asSpoken": "Couldn't tidy that up, so it's written as you said it.",
};

registerTranslations(english, {});
