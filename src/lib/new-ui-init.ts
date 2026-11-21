/** Runs in <head> before paint: mirrors the new-UI flag onto <html class="new-ui"> so tokens/fonts don't flash. */
export const newUiInitScript = `(function(){try{var q=new URLSearchParams(location.search).get("ui");if(q==="old")localStorage.setItem("scribe.newUi","0");if(q==="new")localStorage.removeItem("scribe.newUi");var on=${process.env.NEXT_PUBLIC_NEW_UI === "0" ? "false" : "true"}&&localStorage.getItem("scribe.newUi")!=="0";if(on)document.documentElement.classList.add("new-ui");}catch(e){}})();`;

/** First thing in <body>: the legacy (`?ui=old`) screens do not use the product tokens that `app-brand` on <body> brings. */
export const legacyBodyScript = `(function(){try{if(!document.documentElement.classList.contains("new-ui"))document.body.classList.remove("app-brand");}catch(e){}})();`;
