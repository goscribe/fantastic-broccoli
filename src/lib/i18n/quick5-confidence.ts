import { registerTranslations } from "@/lib/i18n";

// The confidence question on a session's wait screen
// (src/components/session/wait-confidence.tsx) and a Quick 5's end screen
// (its score out of 5 and the harder-questions line). Imported for side effect. English only for now.
const en = {
  "quick5Conf.whileWriting": "While your 5 questions are written",
  "quick5Conf.whileWritingSession": "While your session is written",
  "quick5Conf.ready": "Your 5 questions are ready",
  "quick5Conf.picks": "Your answer picks which 5 questions you get.",
  "quick5Conf.next.gentle": "The notes first, then easier questions. No hard ones.",
  "quick5Conf.next.mixed": "A warm-up, then harder questions.",
  "quick5Conf.next.hard": "Straight to the harder questions.",

  "quick5Conf.saidGot": "You said {a}/10. You got {b}/{n}.",
  // "Harder" = the medium and hard rungs of the Quick 5 pool: a step up from the warm-up. They are
  // Scribe's own multiple-choice questions, not written in any board's paper format, so nothing here
  // says "exam".
  "quick5Conf.examLevel": "{r} of {n} harder questions right.",
  "quick5Conf.examLevelMissed": "Those go a step beyond the warm-up, so missing some on day one is normal. They show exactly what to practise next.",
  "quick5Conf.examLevelAll": "Those go a step beyond the warm-up. Nicely done.",
};

registerTranslations(en, {});
