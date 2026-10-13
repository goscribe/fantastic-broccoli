import { registerTranslations } from "@/lib/i18n";

// "Schedule next" review reminders: debrief card, home strip, review page.
const en = {
  "retention.scheduleTitle": "Lock in what you learned",
  "retention.quick5Title": "That's your 5 for today",
  "retention.scheduleBodyOne":
    "1 card from today comes due tomorrow — about {minutes} min. Pick a time and your review will be waiting.",
  "retention.scheduleBodyMany":
    "{count} cards from today come due tomorrow — about {minutes} min. Pick a time and your review will be waiting.",
  "retention.scheduleBodyShort":
    "A short review tomorrow — about {minutes} min — locks in today's session while it's fresh.",
  "retention.reviewTime": "Review time",
  "retention.scheduleTomorrow": "Schedule tomorrow's review",
  "retention.schedule": "Schedule review",
  "retention.notNow": "Not now",
  "retention.pickFutureTime": "Pick a time in the future.",
  "retention.scheduledTitle": "Review scheduled for {when}",
  "retention.scheduledBody":
    "When it's time, your home screen shows “Your review is ready” — one tap starts it. Want a nudge outside Scribe? Add it to your calendar.",
  "retention.addGoogle": "Add to Google Calendar",
  "retention.downloadIcs": "Apple / Outlook (.ics)",
  "retention.changeTime": "Change time",
  "retention.save": "Save",
  "retention.cancel": "Cancel",
  "retention.today": "today at {time}",
  "retention.tomorrow": "tomorrow at {time}",
  "retention.reviewReady": "Your review is ready",
  "retention.cardsAbout": "{count} cards · about {minutes} min",
  "retention.cardAbout": "1 card · about {minutes} min",
  "retention.aboutMinutes": "About {minutes} min",
  "retention.start": "Start",
  "retention.nextReview": "Next review {when}",
  "retention.startQuickSession": "Start a quick session",
};

registerTranslations(en, {
  es: {
    "retention.scheduleTitle": "Afianza lo que aprendiste",
    "retention.quick5Title": "Esas son tus 5 de hoy",
    "retention.scheduleBodyOne":
      "1 tarjeta de hoy vence mañana — unos {minutes} min. Elige una hora y tu repaso te estará esperando.",
    "retention.scheduleBodyMany":
      "{count} tarjetas de hoy vencen mañana — unos {minutes} min. Elige una hora y tu repaso te estará esperando.",
    "retention.scheduleBodyShort":
      "Un repaso corto mañana — unos {minutes} min — afianza la sesión de hoy mientras está fresca.",
    "retention.reviewTime": "Hora del repaso",
    "retention.scheduleTomorrow": "Programar el repaso de mañana",
    "retention.schedule": "Programar repaso",
    "retention.notNow": "Ahora no",
    "retention.pickFutureTime": "Elige una hora futura.",
    "retention.scheduledTitle": "Repaso programado para {when}",
    "retention.scheduledBody":
      "Cuando sea la hora, tu pantalla de inicio mostrará “Tu repaso está listo” — un toque y empiezas. ¿Quieres un aviso fuera de Scribe? Añádelo a tu calendario.",
    "retention.addGoogle": "Añadir a Google Calendar",
    "retention.downloadIcs": "Apple / Outlook (.ics)",
    "retention.changeTime": "Cambiar hora",
    "retention.save": "Guardar",
    "retention.cancel": "Cancelar",
    "retention.today": "hoy a las {time}",
    "retention.tomorrow": "mañana a las {time}",
    "retention.reviewReady": "Tu repaso está listo",
    "retention.cardsAbout": "{count} tarjetas · unos {minutes} min",
    "retention.cardAbout": "1 tarjeta · unos {minutes} min",
    "retention.aboutMinutes": "Unos {minutes} min",
    "retention.start": "Empezar",
    "retention.nextReview": "Próximo repaso {when}",
    "retention.startQuickSession": "Empezar una sesión rápida",
  },
});
