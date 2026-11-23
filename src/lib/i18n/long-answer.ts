import { registerTranslations } from "@/lib/i18n";

// Long-answer questions (src/components/session/long-answer-activity.tsx). Imported for side effect.
const en = {
  "laq.eyebrow": "Long answer · {m} marks · ~{min} min",
  "laq.yourAnswer": "Your answer",
  "laq.placeholder": "Write your answer in full sentences, as you would in the exam…",
  "laq.word": "{n} word",
  "laq.words": "{n} words",
  "laq.aim": "full-mark answers run to about {n}",
  "laq.submit": "Submit for marking",
  "laq.marking": "Marking your answer…",
  "laq.markingFailed": "Couldn't mark that just now. Your answer is saved; try again in a moment.",
  "laq.skip": "Skip for now",
  "laq.marks": "marks",
  "laq.addedToMistakes": "Added to your mistakes to come back to.",
  "laq.earned": "Marks you earned",
  "laq.missed": "Marks you missed",
  "laq.showModel": "Show model answer",
  "laq.hideModel": "Hide model answer",
  "laq.continue": "Continue",
};

registerTranslations(en, {
  es: { "laq.eyebrow": "Respuesta larga · {m} puntos · ~{min} min", "laq.yourAnswer": "Tu respuesta", "laq.placeholder": "Escribe tu respuesta con frases completas, como en el examen…", "laq.word": "{n} palabra", "laq.words": "{n} palabras", "laq.aim": "las respuestas de nota máxima rondan las {n}", "laq.submit": "Enviar para corregir", "laq.marking": "Corrigiendo tu respuesta…", "laq.markingFailed": "No se pudo corregir ahora. Tu respuesta está guardada; inténtalo en un momento.", "laq.skip": "Saltar por ahora", "laq.marks": "puntos", "laq.addedToMistakes": "Añadida a tus errores para repasar.", "laq.earned": "Puntos conseguidos", "laq.missed": "Puntos perdidos", "laq.showModel": "Ver respuesta modelo", "laq.hideModel": "Ocultar respuesta modelo", "laq.continue": "Continuar" },
  fr: { "laq.eyebrow": "Réponse longue · {m} points · ~{min} min", "laq.yourAnswer": "Ta réponse", "laq.placeholder": "Rédige ta réponse en phrases complètes, comme à l’examen…", "laq.word": "{n} mot", "laq.words": "{n} mots", "laq.aim": "une réponse à la note maximale fait environ {n}", "laq.submit": "Envoyer pour correction", "laq.marking": "Correction en cours…", "laq.markingFailed": "Correction impossible pour l’instant. Ta réponse est enregistrée ; réessaie dans un moment.", "laq.skip": "Passer pour l’instant", "laq.marks": "points", "laq.addedToMistakes": "Ajoutée à tes erreurs à revoir.", "laq.earned": "Points obtenus", "laq.missed": "Points manqués", "laq.showModel": "Voir la réponse modèle", "laq.hideModel": "Masquer la réponse modèle", "laq.continue": "Continuer" },
  de: { "laq.eyebrow": "Lange Antwort · {m} Punkte · ~{min} Min.", "laq.yourAnswer": "Deine Antwort", "laq.placeholder": "Schreib deine Antwort in ganzen Sätzen, wie in der Prüfung…", "laq.word": "{n} Wort", "laq.words": "{n} Wörter", "laq.aim": "Antworten mit voller Punktzahl haben etwa {n}", "laq.submit": "Zur Bewertung senden", "laq.marking": "Deine Antwort wird bewertet…", "laq.markingFailed": "Gerade keine Bewertung möglich. Deine Antwort ist gespeichert; versuch es gleich nochmal.", "laq.skip": "Erst mal überspringen", "laq.marks": "Punkte", "laq.addedToMistakes": "Zu deinen Fehlern zum Wiederholen hinzugefügt.", "laq.earned": "Erreichte Punkte", "laq.missed": "Verpasste Punkte", "laq.showModel": "Musterantwort zeigen", "laq.hideModel": "Musterantwort ausblenden", "laq.continue": "Weiter" },
});
