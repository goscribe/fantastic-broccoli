import { registerTranslations } from "@/lib/i18n";

// Finishable written work: answer-length guides, help (hint, first step),
// per-part checking, model answers, and the short comprehension check.
// Imported for side effect by worksheet-activity, long-answer-activity and
// comprehension-activity.
registerTranslations(
  {
    "written.guideValue": "One value with its unit",
    "written.guideWorking": "A line of working and the answer",
    "written.guideLine": "One line",
    "written.guideSentences": "One or two sentences",
    "written.guideParagraph": "A short paragraph",
    "written.guideParagraphs": "A few paragraphs",
    "written.hint": "Hint",
    "written.firstStep": "Show the first step",
    "written.hintLabel": "Hint",
    "written.firstStepLabel": "First step",
    "written.checkPart": "Check this part",
    "written.checking": "Checking…",
    "written.finishQuestion": "Finish question",
    "written.modelAnswer": "See the model answer",
    "written.hideModel": "Hide the model answer",
    "written.modelAnswerLabel": "Model answer",
    "written.skippedModel": "Skipped. Here's an answer that gets full marks:",
    "written.skipMovesOn": "Skip",
    "written.marksOf": "{n} of {m} marks",
    "written.retryMarking": "Couldn't mark this part. Try again, or skip it.",
    "comp.checkAnswer": "Check",
    "comp.why": "Why? In one line",
    "comp.whyPlaceholder": "Because…",
    "comp.answerPlaceholder": "Answer in a sentence or two",
    "comp.pointsMade": "What a full answer says",
    "comp.continue": "Continue",
    "comp.skip": "Skip",
    "comp.correctChoice": "Right answer",
    "comp.wrongChoice": "Not quite. The answer is {a}.",
    "comp.continueAnyway": "Continue",
  },
  {},
);
