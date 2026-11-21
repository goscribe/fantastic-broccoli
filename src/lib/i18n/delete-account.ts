// Strings for the "Delete account" section of Settings and its dialog.
// Imported for side effect by components/settings/delete-account-section.
// {date} is the permanent-deletion date, {days} the grace period, {email}
// the account email, {word} the confirm word (DELETE, never translated).
//
// Facts from goscribe/server: the account is soft-deleted at once and every
// session (all devices) stops working; it is hard-deleted 30 days later; the
// email has a restore link valid for those 30 days. Billing: at the request a
// subscription is set to cancel at the end of the current period (no further
// charge); restoring before then resumes it; at the hard delete anything still
// running is cancelled immediately with no refund. One-time passes never renew.

import { registerTranslations } from "@/lib/i18n";

const english = {
  "del.title": "Delete account",
  "del.hint":
    "Your account and everything in it are permanently removed {days} days after you ask. Until then, the link in the email we send you restores it.",
  "del.open": "Delete account",
  "del.dialogTitle": "Delete your Scribe account?",
  "del.signedOut":
    "You're signed out straight away and can't sign in again unless you restore the account.",
  "del.permanent":
    "On {date} ({days} days from now) your account and everything in it — subjects, uploads, study sessions and notes — are permanently deleted. After that it can't be undone.",
  "del.restore": "We email you a link to restore your account. It works until {date}.",
  "del.billing":
    "Your subscription stops renewing now, so you won't be charged again. If you restore your account before your current billing period ends, it carries on as normal; after that, you'd need to subscribe again. Anything still active is cancelled, with no refund, when the account is deleted. A one-time pass isn't charged again.",
  "del.typeLabel": "Type {word} or your email to confirm",
  "del.confirm": "Delete my account",
  "del.deleting": "Deleting…",
  "del.cancel": "Keep my account",
  "del.errorSession": "Your session has expired. Sign in again, then try again.",
  "del.errorGeneric":
    "We couldn't schedule the deletion, so nothing has changed. Check your connection and try again.",
  "del.doneTitle": "Your account is scheduled for deletion",
  "del.doneBody": "It will be permanently deleted on {date}. You've been signed out.",
  "del.doneEmail": "We've emailed {email} a link to restore your account before then.",
  "del.doneEmailNoAddress": "We've emailed you a link to restore your account before then.",
  "del.doneHome": "Go to the Scribe home page",
};

registerTranslations(english, {
  es: {
    "del.title": "Eliminar cuenta",
    "del.hint":
      "Tu cuenta y todo su contenido se eliminan para siempre {days} días después de pedirlo. Hasta entonces, el enlace del correo que te enviamos la restaura.",
    "del.open": "Eliminar cuenta",
    "del.dialogTitle": "¿Eliminar tu cuenta de Scribe?",
    "del.signedOut":
      "Se cerrará tu sesión de inmediato y no podrás volver a entrar a menos que restaures la cuenta.",
    "del.permanent":
      "El {date} (dentro de {days} días) tu cuenta y todo su contenido — asignaturas, archivos, sesiones de estudio y apuntes — se eliminan para siempre. Después no se puede deshacer.",
    "del.restore": "Te enviamos por correo un enlace para restaurar tu cuenta. Funciona hasta el {date}.",
    "del.billing":
      "Tu suscripción deja de renovarse ahora, así que no se te volverá a cobrar. Si restauras tu cuenta antes de que termine tu periodo de facturación actual, sigue como siempre; después, tendrías que volver a suscribirte. Lo que siga activo se cancela, sin reembolso, cuando se elimina la cuenta. Un pase de pago único no se vuelve a cobrar.",
    "del.typeLabel": "Escribe {word} o tu correo para confirmar",
    "del.confirm": "Eliminar mi cuenta",
    "del.deleting": "Eliminando…",
    "del.cancel": "Mantener mi cuenta",
    "del.errorSession": "Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.",
    "del.errorGeneric":
      "No pudimos programar la eliminación, así que no ha cambiado nada. Revisa tu conexión e inténtalo de nuevo.",
    "del.doneTitle": "Tu cuenta está programada para eliminarse",
    "del.doneBody": "Se eliminará para siempre el {date}. Se ha cerrado tu sesión.",
    "del.doneEmail": "Hemos enviado a {email} un enlace para restaurar tu cuenta antes de esa fecha.",
    "del.doneEmailNoAddress": "Te hemos enviado un enlace para restaurar tu cuenta antes de esa fecha.",
    "del.doneHome": "Ir a la página de inicio de Scribe",
  },
  fr: {
    "del.title": "Supprimer le compte",
    "del.hint":
      "Votre compte et tout son contenu sont supprimés définitivement {days} jours après votre demande. D'ici là, le lien de l'e-mail que nous vous envoyons le restaure.",
    "del.open": "Supprimer le compte",
    "del.dialogTitle": "Supprimer votre compte Scribe ?",
    "del.signedOut":
      "Vous êtes déconnecté immédiatement et ne pourrez plus vous connecter sauf si vous restaurez le compte.",
    "del.permanent":
      "Le {date} (dans {days} jours), votre compte et tout son contenu — matières, fichiers, sessions d'étude et notes — sont supprimés définitivement. Ensuite, c'est irréversible.",
    "del.restore": "Nous vous envoyons par e-mail un lien pour restaurer votre compte. Il fonctionne jusqu'au {date}.",
    "del.billing":
      "Votre abonnement cesse de se renouveler dès maintenant : vous ne serez plus facturé. Si vous restaurez votre compte avant la fin de votre période de facturation en cours, il continue normalement ; après, il faudra vous réabonner. Ce qui est encore actif est annulé, sans remboursement, lorsque le compte est supprimé. Un pass payé une seule fois n'est plus facturé.",
    "del.typeLabel": "Tapez {word} ou votre e-mail pour confirmer",
    "del.confirm": "Supprimer mon compte",
    "del.deleting": "Suppression…",
    "del.cancel": "Garder mon compte",
    "del.errorSession": "Votre session a expiré. Reconnectez-vous, puis réessayez.",
    "del.errorGeneric":
      "Nous n'avons pas pu programmer la suppression, rien n'a donc changé. Vérifiez votre connexion et réessayez.",
    "del.doneTitle": "La suppression de votre compte est programmée",
    "del.doneBody": "Il sera supprimé définitivement le {date}. Vous avez été déconnecté.",
    "del.doneEmail": "Nous avons envoyé à {email} un lien pour restaurer votre compte d'ici là.",
    "del.doneEmailNoAddress": "Nous vous avons envoyé un lien pour restaurer votre compte d'ici là.",
    "del.doneHome": "Aller à l'accueil de Scribe",
  },
  de: {
    "del.title": "Konto löschen",
    "del.hint":
      "Dein Konto und alles darin wird {days} Tage nach deiner Anfrage endgültig gelöscht. Bis dahin stellt der Link in unserer E-Mail es wieder her.",
    "del.open": "Konto löschen",
    "del.dialogTitle": "Dein Scribe-Konto löschen?",
    "del.signedOut":
      "Du wirst sofort abgemeldet und kannst dich erst wieder anmelden, wenn du das Konto wiederherstellst.",
    "del.permanent":
      "Am {date} (in {days} Tagen) werden dein Konto und alles darin — Fächer, Uploads, Lerneinheiten und Notizen — endgültig gelöscht. Danach lässt sich das nicht rückgängig machen.",
    "del.restore": "Wir schicken dir per E-Mail einen Link, um dein Konto wiederherzustellen. Er gilt bis zum {date}.",
    "del.billing":
      "Dein Abo verlängert sich ab sofort nicht mehr, dir wird also nichts mehr berechnet. Wenn du dein Konto vor dem Ende deines aktuellen Abrechnungszeitraums wiederherstellst, läuft es normal weiter; danach müsstest du es neu abschließen. Was dann noch aktiv ist, wird beim Löschen des Kontos ohne Erstattung gekündigt. Ein einmal bezahlter Pass wird nicht erneut berechnet.",
    "del.typeLabel": "Gib {word} oder deine E-Mail ein, um zu bestätigen",
    "del.confirm": "Mein Konto löschen",
    "del.deleting": "Wird gelöscht…",
    "del.cancel": "Konto behalten",
    "del.errorSession": "Deine Sitzung ist abgelaufen. Melde dich erneut an und versuche es noch einmal.",
    "del.errorGeneric":
      "Wir konnten die Löschung nicht planen, es hat sich also nichts geändert. Prüfe deine Verbindung und versuche es erneut.",
    "del.doneTitle": "Dein Konto wird gelöscht",
    "del.doneBody": "Es wird am {date} endgültig gelöscht. Du wurdest abgemeldet.",
    "del.doneEmail": "Wir haben {email} einen Link geschickt, mit dem du dein Konto bis dahin wiederherstellen kannst.",
    "del.doneEmailNoAddress": "Wir haben dir einen Link geschickt, mit dem du dein Konto bis dahin wiederherstellen kannst.",
    "del.doneHome": "Zur Scribe-Startseite",
  },
  zh: {
    "del.title": "删除账户",
    "del.hint": "你的账户及其中所有内容会在你申请后 {days} 天被永久删除。在此之前，我们发给你的邮件中的链接可以恢复账户。",
    "del.open": "删除账户",
    "del.dialogTitle": "删除你的 Scribe 账户？",
    "del.signedOut": "你会立即退出登录，除非恢复账户，否则无法再次登录。",
    "del.permanent":
      "{date}（{days} 天后），你的账户及其中所有内容——科目、上传的文件、学习环节和笔记——将被永久删除。之后无法撤销。",
    "del.restore": "我们会通过邮件发送恢复账户的链接，在 {date} 之前有效。",
    "del.billing":
      "你的订阅从现在起停止续费，不会再扣费。如果你在当前计费周期结束前恢复账户，订阅会照常继续；之后则需要重新订阅。账户被删除时，仍在生效的订阅会被取消，且不退款。一次性通行证不会再次扣费。",
    "del.typeLabel": "输入 {word} 或你的邮箱以确认",
    "del.confirm": "删除我的账户",
    "del.deleting": "正在删除…",
    "del.cancel": "保留我的账户",
    "del.errorSession": "你的登录已过期。请重新登录后再试。",
    "del.errorGeneric": "未能安排删除，因此没有任何更改。请检查网络连接后重试。",
    "del.doneTitle": "你的账户已安排删除",
    "del.doneBody": "账户将于 {date} 被永久删除。你已退出登录。",
    "del.doneEmail": "我们已向 {email} 发送了一个链接，你可以在此之前用它恢复账户。",
    "del.doneEmailNoAddress": "我们已向你发送了一个链接，你可以在此之前用它恢复账户。",
    "del.doneHome": "前往 Scribe 首页",
  },
  hi: {
    "del.title": "खाता हटाएँ",
    "del.hint":
      "आपके अनुरोध के {days} दिन बाद आपका खाता और उसमें मौजूद सब कुछ हमेशा के लिए हटा दिया जाता है। तब तक, हमारे भेजे ईमेल का लिंक इसे बहाल कर देता है।",
    "del.open": "खाता हटाएँ",
    "del.dialogTitle": "अपना Scribe खाता हटाएँ?",
    "del.signedOut": "आप तुरंत साइन आउट हो जाएँगे और खाता बहाल किए बिना दोबारा साइन इन नहीं कर पाएँगे।",
    "del.permanent":
      "{date} को ({days} दिन बाद) आपका खाता और उसमें मौजूद सब कुछ — विषय, अपलोड, स्टडी सेशन और नोट्स — हमेशा के लिए हटा दिए जाएँगे। उसके बाद इसे वापस नहीं किया जा सकता।",
    "del.restore": "हम आपको खाता बहाल करने का लिंक ईमेल करते हैं। यह {date} तक काम करता है।",
    "del.billing":
      "आपकी सदस्यता अब से रिन्यू नहीं होगी, इसलिए आपसे दोबारा शुल्क नहीं लिया जाएगा। अगर आप मौजूदा बिलिंग अवधि खत्म होने से पहले अपना खाता बहाल करते हैं, तो यह पहले की तरह चलती रहेगी; उसके बाद आपको फिर से सदस्यता लेनी होगी। खाता हटाए जाने पर जो कुछ भी अब भी सक्रिय है, वह बिना रिफ़ंड के रद्द कर दिया जाता है। एक बार खरीदे गए पास पर दोबारा शुल्क नहीं लगता।",
    "del.typeLabel": "पुष्टि के लिए {word} या अपना ईमेल लिखें",
    "del.confirm": "मेरा खाता हटाएँ",
    "del.deleting": "हटाया जा रहा है…",
    "del.cancel": "मेरा खाता रखें",
    "del.errorSession": "आपका सेशन समाप्त हो गया है। फिर से साइन इन करें, फिर दोबारा कोशिश करें।",
    "del.errorGeneric":
      "हम खाता हटाना शेड्यूल नहीं कर सके, इसलिए कुछ नहीं बदला। अपना कनेक्शन जाँचें और फिर से कोशिश करें।",
    "del.doneTitle": "आपका खाता हटाने के लिए शेड्यूल हो गया है",
    "del.doneBody": "यह {date} को हमेशा के लिए हटा दिया जाएगा। आप साइन आउट हो गए हैं।",
    "del.doneEmail": "हमने {email} पर एक लिंक भेजा है जिससे आप उससे पहले अपना खाता बहाल कर सकते हैं।",
    "del.doneEmailNoAddress": "हमने आपको एक लिंक भेजा है जिससे आप उससे पहले अपना खाता बहाल कर सकते हैं।",
    "del.doneHome": "Scribe होम पेज पर जाएँ",
  },
  tl: {
    "del.title": "Burahin ang account",
    "del.hint":
      "Permanenteng buburahin ang account mo at lahat ng laman nito {days} araw matapos mong hilingin. Hanggang doon, maibabalik ito ng link sa email na ipapadala namin.",
    "del.open": "Burahin ang account",
    "del.dialogTitle": "Burahin ang iyong Scribe account?",
    "del.signedOut":
      "Masa-sign out ka agad at hindi ka na makaka-sign in maliban kung ibalik mo ang account.",
    "del.permanent":
      "Sa {date} ({days} araw mula ngayon), permanenteng buburahin ang account mo at lahat ng laman nito — mga subject, upload, study session at notes. Pagkatapos noon, hindi na ito maibabalik.",
    "del.restore": "Mag-e-email kami ng link para maibalik ang account mo. Gumagana ito hanggang {date}.",
    "del.billing":
      "Hihinto na ngayon ang pag-renew ng subscription mo, kaya hindi ka na sisingilin ulit. Kung ibabalik mo ang account bago matapos ang kasalukuyang billing period mo, tuloy ito gaya ng dati; pagkatapos noon, kailangan mong mag-subscribe ulit. Kakanselahin, nang walang refund, ang anumang aktibo pa kapag binura na ang account. Hindi na sisingilin muli ang isang beses na pass.",
    "del.typeLabel": "I-type ang {word} o ang email mo para kumpirmahin",
    "del.confirm": "Burahin ang account ko",
    "del.deleting": "Binubura…",
    "del.cancel": "Panatilihin ang account ko",
    "del.errorSession": "Nag-expire na ang session mo. Mag-sign in ulit, saka subukan muli.",
    "del.errorGeneric":
      "Hindi namin naiskedyul ang pagbura, kaya walang nagbago. Tingnan ang koneksyon mo at subukan muli.",
    "del.doneTitle": "Naka-iskedyul nang burahin ang account mo",
    "del.doneBody": "Permanente itong buburahin sa {date}. Na-sign out ka na.",
    "del.doneEmail": "Nag-email kami sa {email} ng link para maibalik ang account mo bago noon.",
    "del.doneEmailNoAddress": "Nag-email kami sa iyo ng link para maibalik ang account mo bago noon.",
    "del.doneHome": "Pumunta sa home page ng Scribe",
  },
});
