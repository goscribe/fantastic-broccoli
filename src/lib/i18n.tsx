"use client";

/**
 * Lightweight UI internationalisation. The locale mirrors the user's
 * server-side `preferredLanguage` (set in Settings); it is cached in
 * localStorage so the UI paints in the right language before the session
 * resolves. `t(key)` falls back to English for untranslated keys/locales.
 */

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export const UI_LOCALES = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  zh: "中文（简体）",
  hi: "हिन्दी",
  tl: "Filipino",
  ja: "日本語",
  ko: "한국어",
  pt: "Português",
  it: "Italiano",
  ar: "العربية",
  ru: "Русский",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  tr: "Türkçe",
} as const;

export type Locale = keyof typeof UI_LOCALES;

const en = {
  "nav.home": "Home",
  "nav.flashcards": "Flashcards",
  "nav.shared": "Shared",
  "nav.settings": "Settings",
  "nav.folders": "Folders",
  "nav.newWorkspace": "New workspace",
  "nav.newFolder": "New folder",
  "nav.signOut": "Sign out",
  "nav.storage": "Storage",
  "nav.tokens": "Tokens",
  "home.continueStudying": "Continue studying",
  "home.getStarted": "Get started",
  "home.resumeSession": "Resume session",
  "home.cardsDue": "cards due for review",
  "home.reviewNow": "Review now",
  "settings.title": "Settings",
  "settings.account": "Account",
  "settings.plan": "Plan",
  "settings.usage": "Usage",
  "settings.language": "Language",
  "settings.languageHint":
    "Used for the app and for generated study content (sessions, flashcards, podcasts).",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.loading": "Loading…",
} as const;

export type TranslationKey = keyof typeof en;

type Dictionary = Partial<Record<TranslationKey, string>>;

const dictionaries: Partial<Record<Locale, Dictionary>> = {
  en,
  es: {
    "nav.home": "Inicio",
    "nav.flashcards": "Tarjetas",
    "nav.shared": "Compartido",
    "nav.settings": "Ajustes",
    "nav.folders": "Carpetas",
    "nav.newWorkspace": "Nuevo espacio",
    "nav.newFolder": "Nueva carpeta",
    "nav.signOut": "Cerrar sesión",
    "nav.storage": "Almacenamiento",
    "nav.tokens": "Tokens",
    "home.continueStudying": "Seguir estudiando",
    "home.getStarted": "Empezar",
    "home.resumeSession": "Reanudar sesión",
    "home.cardsDue": "tarjetas por repasar",
    "home.reviewNow": "Repasar ahora",
    "settings.title": "Ajustes",
    "settings.account": "Cuenta",
    "settings.plan": "Plan",
    "settings.usage": "Uso",
    "settings.language": "Idioma",
    "settings.languageHint":
      "Se usa para la aplicación y para el contenido de estudio generado (sesiones, tarjetas, pódcasts).",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.loading": "Cargando…",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.flashcards": "Cartes",
    "nav.shared": "Partagé",
    "nav.settings": "Paramètres",
    "nav.folders": "Dossiers",
    "nav.newWorkspace": "Nouvel espace",
    "nav.newFolder": "Nouveau dossier",
    "nav.signOut": "Se déconnecter",
    "nav.storage": "Stockage",
    "nav.tokens": "Jetons",
    "home.continueStudying": "Continuer à étudier",
    "home.getStarted": "Commencer",
    "home.resumeSession": "Reprendre la session",
    "home.cardsDue": "cartes à réviser",
    "home.reviewNow": "Réviser maintenant",
    "settings.title": "Paramètres",
    "settings.account": "Compte",
    "settings.plan": "Forfait",
    "settings.usage": "Utilisation",
    "settings.language": "Langue",
    "settings.languageHint":
      "Utilisée pour l'application et pour le contenu d'étude généré (sessions, cartes, podcasts).",
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.delete": "Supprimer",
    "common.loading": "Chargement…",
  },
  de: {
    "nav.home": "Start",
    "nav.flashcards": "Karteikarten",
    "nav.shared": "Geteilt",
    "nav.settings": "Einstellungen",
    "nav.folders": "Ordner",
    "nav.newWorkspace": "Neuer Arbeitsbereich",
    "nav.newFolder": "Neuer Ordner",
    "nav.signOut": "Abmelden",
    "nav.storage": "Speicher",
    "nav.tokens": "Tokens",
    "home.continueStudying": "Weiterlernen",
    "home.getStarted": "Loslegen",
    "home.resumeSession": "Sitzung fortsetzen",
    "home.cardsDue": "Karten fällig",
    "home.reviewNow": "Jetzt wiederholen",
    "settings.title": "Einstellungen",
    "settings.account": "Konto",
    "settings.plan": "Tarif",
    "settings.usage": "Nutzung",
    "settings.language": "Sprache",
    "settings.languageHint":
      "Gilt für die App und für generierte Lerninhalte (Sitzungen, Karteikarten, Podcasts).",
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.delete": "Löschen",
    "common.loading": "Lädt…",
  },
  zh: {
    "nav.home": "主页",
    "nav.flashcards": "闪卡",
    "nav.shared": "共享",
    "nav.settings": "设置",
    "nav.folders": "文件夹",
    "nav.newWorkspace": "新建工作区",
    "nav.newFolder": "新建文件夹",
    "nav.signOut": "退出登录",
    "nav.storage": "存储",
    "nav.tokens": "代币",
    "home.continueStudying": "继续学习",
    "home.getStarted": "开始使用",
    "home.resumeSession": "继续上次学习",
    "home.cardsDue": "张卡片待复习",
    "home.reviewNow": "立即复习",
    "settings.title": "设置",
    "settings.account": "账户",
    "settings.plan": "套餐",
    "settings.usage": "用量",
    "settings.language": "语言",
    "settings.languageHint":
      "用于应用界面和生成的学习内容（学习会话、闪卡、播客）。",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.loading": "加载中…",
  },
  hi: {
    "nav.home": "होम",
    "nav.flashcards": "फ़्लैशकार्ड",
    "nav.shared": "साझा",
    "nav.settings": "सेटिंग्स",
    "nav.folders": "फ़ोल्डर",
    "nav.newWorkspace": "नया वर्कस्पेस",
    "nav.newFolder": "नया फ़ोल्डर",
    "nav.signOut": "साइन आउट",
    "nav.storage": "स्टोरेज",
    "nav.tokens": "टोकन",
    "home.continueStudying": "पढ़ाई जारी रखें",
    "home.getStarted": "शुरू करें",
    "home.resumeSession": "सत्र फिर शुरू करें",
    "home.cardsDue": "कार्ड समीक्षा के लिए",
    "home.reviewNow": "अभी दोहराएँ",
    "settings.title": "सेटिंग्स",
    "settings.account": "खाता",
    "settings.plan": "प्लान",
    "settings.usage": "उपयोग",
    "settings.language": "भाषा",
    "settings.languageHint":
      "ऐप और जनरेट की गई अध्ययन सामग्री (सत्र, फ़्लैशकार्ड, पॉडकास्ट) के लिए उपयोग होती है।",
    "common.save": "सहेजें",
    "common.cancel": "रद्द करें",
    "common.delete": "हटाएँ",
    "common.loading": "लोड हो रहा है…",
  },
  tl: {
    "nav.home": "Home",
    "nav.flashcards": "Flashcards",
    "nav.shared": "Naibahagi",
    "nav.settings": "Mga Setting",
    "nav.folders": "Mga Folder",
    "nav.newWorkspace": "Bagong workspace",
    "nav.newFolder": "Bagong folder",
    "nav.signOut": "Mag-sign out",
    "nav.storage": "Storage",
    "nav.tokens": "Tokens",
    "home.continueStudying": "Magpatuloy sa pag-aaral",
    "home.getStarted": "Magsimula",
    "home.resumeSession": "Ituloy ang session",
    "home.cardsDue": "cards na dapat repasuhin",
    "home.reviewNow": "Mag-review ngayon",
    "settings.title": "Mga Setting",
    "settings.account": "Account",
    "settings.plan": "Plano",
    "settings.usage": "Paggamit",
    "settings.language": "Wika",
    "settings.languageHint":
      "Ginagamit para sa app at sa mga ginawang study content (sessions, flashcards, podcasts).",
    "common.save": "I-save",
    "common.cancel": "Kanselahin",
    "common.delete": "Burahin",
    "common.loading": "Naglo-load…",
  },
};

const STORAGE_KEY = "scribe.locale";

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && stored in UI_LOCALES ? (stored as Locale) : "en";
}

const localeListeners = new Set<(locale: Locale) => void>();

/** Persist the locale and update every mounted I18nProvider. */
export function setUiLocale(locale: Locale): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }
  localeListeners.forEach((listener) => listener(locale));
}

/** Adopt the server-side preference (called when the session resolves). */
export function syncUiLocale(preferredLanguage: string | undefined): void {
  if (!preferredLanguage || !(preferredLanguage in UI_LOCALES)) return;
  const locale = preferredLanguage as Locale;
  if (locale !== readStoredLocale()) setUiLocale(locale);
}

interface I18nValue {
  locale: Locale;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: "en",
  t: (key) => en[key],
});

function subscribeToLocale(onChange: () => void): () => void {
  const listener = () => onChange();
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    readStoredLocale,
    () => "en" as Locale,
  );

  const t = (key: TranslationKey): string =>
    dictionaries[locale]?.[key] ?? en[key];

  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
