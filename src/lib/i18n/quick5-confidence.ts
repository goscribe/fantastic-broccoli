import { registerTranslations } from "@/lib/i18n";

// The confidence question on a session's wait screen
// (src/components/session/wait-confidence.tsx) and a Quick 5's end screen
// (its score out of 5 and the exam-level line). Imported for side effect. English only for now.
const en = {
  "quick5Conf.whileWriting": "While your 5 questions are written",
  "quick5Conf.whileWritingSession": "While your session is written",
  "quick5Conf.ready": "Your 5 questions are ready",
  "quick5Conf.nextSession": "We'll pitch your questions to it from here on.",
  "quick5Conf.next.gentle": "We'll build up gently, one hard one at the end.",
  "quick5Conf.next.mixed": "A warm-up, then exam-level questions.",
  "quick5Conf.next.hard": "Straight to exam-level, mostly hard ones.",

  "quick5Conf.saidGot": "You said {a}/10. You got {b}/{n}.",
  "quick5Conf.examLevel": "{r} of {n} exam-level questions right.",
  "quick5Conf.examLevelMissed": "Those were pitched at the real exam, so missing some on day one is normal. They show exactly what to practise next.",
  "quick5Conf.examLevelAll": "Those were pitched at the real exam. Nicely done.",
};

registerTranslations(en, {});
