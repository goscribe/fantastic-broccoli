/**
 * The part of the day in the visitor's own time zone. It picks the hero's
 * landscape (morning light, afternoon, sunset, night, the small hours) and the
 * greeting above it, so the words and the sky always agree.
 *
 * The server can't know the visitor's clock, so nothing time-dependent is
 * rendered there: a script in <head> writes <html data-daypart="…"> before the
 * first paint and tokens.css picks the scene from it. With no attribute (no
 * JavaScript, a crawler) the page shows the afternoon scene.
 */
export type Daypart = "morning" | "afternoon" | "evening" | "night" | "late";

/** 05–12 morning · 12–17 afternoon · 17–21 evening (sunset) · 21–24 night · 00–05 the small hours. */
export function daypartForHour(hour: number): Daypart {
  if (hour < 5) return "late";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export const DAYPART_ATTR = "data-daypart";

/**
 * Runs in <head> before paint. Keep the hours in step with daypartForHour.
 *
 * It also preloads the one scene file that hour needs (7–21 KB; the same URL
 * tokens.css picks: 800px under 640px wide, 1600px from there up). The scene
 * is a CSS background, which the browser otherwise only finds once the
 * stylesheets are in, so a banner used to show a flat sky first and the
 * picture a moment later.
 */
export const daypartInitScript = `(function(){try{var h=new Date().getHours(),p=h<5?"late":h<12?"morning":h<17?"afternoon":h<21?"evening":"night";document.documentElement.setAttribute("${DAYPART_ATTR}",p);var l=document.createElement("link");l.rel="preload";l.as="image";l.href="/design/hero/"+p+"-"+(window.matchMedia&&matchMedia("(min-width: 640px)").matches?"1600":"800")+".webp";document.head.appendChild(l);}catch(e){}})();`;
