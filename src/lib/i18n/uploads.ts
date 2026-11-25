// Strings for uploads that retry, pause in the background, or don't finish
// (lib/upload-transfer.ts holds the English). Imported for side effect.

import { registerTranslations } from "@/lib/i18n";
import { UPLOAD_COPY } from "@/lib/upload-transfer";

registerTranslations(UPLOAD_COPY, {
  es: {
    "upload.progressOne": "Subiendo tus apuntes…",
    "upload.progressMany": "Subiendo tus apuntes · {done} de {total} archivos",
    "upload.retrying": "Se cortó la conexión — reintentando ({attempt} de {attempts})",
    "upload.paused": "En pausa mientras Scribe está en segundo plano — sigue cuando vuelvas",
    "upload.failedTitle": "Tu subida no terminó — inténtalo de nuevo",
    "upload.failedBody": "No se perdió nada: {name} sigue en tu dispositivo. Revisa tu conexión e inténtalo de nuevo, o pega el texto.",
    "upload.failedBodyMany": "No se perdió nada: {count} archivos siguen en tu dispositivo. Revisa tu conexión e inténtalo de nuevo, o pega el texto.",
    "upload.tryAgain": "Intentar de nuevo",
    "upload.retryingNow": "Reintentando…",
    "upload.pasteInstead": "Pegar texto",
    "upload.leaveHint": "Deja esta pantalla abierta mientras se sube. Cuando esté, puedes salir: te avisaremos cuando tus preguntas estén listas.",
  },
});
