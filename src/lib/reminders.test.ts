import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  plannerWindowFromStudyTime,
  STUDY_TIME_PRESETS,
  canAskPush,
  deviceSeenFor,
  formatStudyTime,
  habitSteps,
  isUsableVapidKey,
  nextHabitStep,
  pushAskDue,
  studyTimeAskDue,
  isGoodSession,
  minuteToTimeInput,
  presetFor,
  timeInputToMinute,
  urlBase64ToUint8Array,
  type Platform,
  type ReminderPrefs,
} from "./reminders";

/** Shaped like a real VAPID public key: 87 URL-safe base64 characters (65 bytes). */
const VAPID = `B${"A".repeat(86)}`;
const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({
  studyReminderMinute: null,
  studyTimeAsked: false,
  pushAsked: false,
  pushAvailable: true,
  vapidPublicKey: VAPID,
  pushDevices: 0,
  timezone: "Europe/Berlin",
  ...over,
});
const desktop: Platform = { ios: false, standalone: false, pushSupported: true, permission: "default", canInstall: false };
const iosSafari: Platform = { ios: true, standalone: false, pushSupported: false, permission: "unsupported", canInstall: false };
const iosHome: Platform = { ios: true, standalone: true, pushSupported: true, permission: "default", canInstall: false };
const android: Platform = { ios: false, standalone: false, pushSupported: true, permission: "default", canInstall: true };
const unseen = { iosInstallHint: false, androidInstall: false };

const NOW = Date.parse("2026-11-26T18:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const steps = (over: Partial<Parameters<typeof habitSteps>[0]> = {}) =>
  habitSteps({ prefs: prefs(), platform: desktop, seen: unseen, goodSession: true, now: NOW, ...over });

describe("habitSteps: what to ask on a finished session's end screen", () => {
  it("asks the study time first, then offers push, on a browser that can push", () => {
    assert.deepEqual(steps(), ["study_time", "push"]);
  });

  it("asks nothing more once an ask was shown in this visit", () => {
    assert.deepEqual(steps({ askedThisVisit: true }), []);
    assert.deepEqual(steps({ askedThisVisit: true, platform: iosSafari }), []);
  });

  it("an answered study time is never asked again; push follows on its own after the quiet period", () => {
    const answered = prefs({ studyReminderMinute: 1140, studyTimeAsked: true, studyTimeAskedAt: daysAgo(1), studyTimeAsks: 1 });
    // Answered yesterday on a phone that couldn't push: no second ask the next day on the laptop.
    assert.deepEqual(steps({ prefs: answered }), []);
    assert.deepEqual(steps({ prefs: { ...answered, studyTimeAskedAt: daysAgo(3) } }), ["push"]);
    assert.deepEqual(steps({ prefs: { ...answered, studyTimeAskedAt: daysAgo(400), studyTimeAsks: 1 } }), ["push"]);
  });

  it("a dismissed study-time ask comes back after a week, three times at most", () => {
    const dismissed = (days: number, asks: number) =>
      prefs({ studyTimeAsked: true, studyTimeAskedAt: daysAgo(days), studyTimeAsks: asks, pushAvailable: false });
    assert.deepEqual(steps({ prefs: dismissed(1, 1) }), []);
    assert.deepEqual(steps({ prefs: dismissed(6.9, 1) }), []);
    assert.deepEqual(steps({ prefs: dismissed(7, 1) }), ["study_time"]);
    assert.deepEqual(steps({ prefs: dismissed(30, 2) }), ["study_time"]);
    assert.deepEqual(steps({ prefs: dismissed(30, 3) }), []);
    assert.equal(studyTimeAskDue(dismissed(30, 3), NOW), false);
  });

  it("a dismissed push offer comes back after a week, three times at most", () => {
    const set = { studyReminderMinute: 1140, studyTimeAsked: true, studyTimeAskedAt: daysAgo(60), studyTimeAsks: 1 };
    const offered = (days: number, asks: number) => prefs({ ...set, pushAsked: true, pushAskedAt: daysAgo(days), pushAsks: asks });
    assert.deepEqual(steps({ prefs: offered(2, 1) }), []);
    assert.deepEqual(steps({ prefs: offered(7, 1) }), ["push"]);
    assert.deepEqual(steps({ prefs: offered(7, 3) }), []);
    assert.equal(pushAskDue(offered(7, 2), desktop, NOW), true);
  });

  it("after a 'not now' on the study time, push is not offered the next day", () => {
    const dismissed = prefs({ studyTimeAsked: true, studyTimeAskedAt: daysAgo(1), studyTimeAsks: 1 });
    assert.deepEqual(steps({ prefs: dismissed }), []);
    assert.deepEqual(steps({ prefs: { ...dismissed, studyTimeAskedAt: daysAgo(3) } }), ["push"]);
  });

  it("an older server (no timestamps) keeps ask-once", () => {
    assert.deepEqual(steps({ prefs: prefs({ studyTimeAsked: true }) }), ["push"]);
    assert.deepEqual(steps({ prefs: prefs({ studyTimeAsked: true, pushAsked: true }) }), []);
  });

  it("never offers push when it can't work: no server keys, a malformed key, or the browser already decided", () => {
    const asked = prefs({ studyReminderMinute: 1140, studyTimeAsked: true });
    assert.deepEqual(steps({ prefs: asked, platform: { ...desktop, permission: "denied" } }), []);
    assert.deepEqual(steps({ prefs: asked, platform: { ...desktop, permission: "granted" } }), []);
    assert.deepEqual(steps({ prefs: asked, platform: { ...desktop, pushSupported: false, permission: "unsupported" } }), []);
    assert.deepEqual(steps({ prefs: { ...asked, pushAvailable: false } }), []);
    assert.deepEqual(steps({ prefs: { ...asked, vapidPublicKey: null } }), []);
    assert.deepEqual(steps({ prefs: { ...asked, vapidPublicKey: "not-a-key" } }), []);
    // The study-time ask still shows without push: the reminder goes by email.
    assert.deepEqual(steps({ prefs: prefs({ pushAvailable: false, vapidPublicKey: null }) }), ["study_time"]);
  });

  it("on iOS Safari keeps the time ask and skips push (it needs the installed app); the Home Screen hint comes once, after a good session", () => {
    assert.deepEqual(steps({ platform: iosSafari }), ["study_time", "ios_install"]);
    assert.deepEqual(steps({ platform: iosSafari, goodSession: false }), ["study_time"]);
    assert.deepEqual(steps({ platform: iosSafari, seen: { ...unseen, iosInstallHint: true } }), ["study_time"]);
    // Even if Safari claims the APIs, the tab can't receive pushes.
    assert.deepEqual(steps({ platform: { ...iosSafari, pushSupported: true, permission: "default" }, goodSession: false }), ["study_time"]);
    assert.equal(pushAskDue(prefs(), { ...iosSafari, pushSupported: true, permission: "default" }, NOW), false);
  });

  it("in the home-screen app on iOS offers push like anywhere else", () => {
    assert.deepEqual(steps({ platform: iosHome }), ["study_time", "push"]);
  });

  it("on Android Chrome offers install once push was asked", () => {
    const asked = prefs({ studyReminderMinute: 960, studyTimeAsked: true, pushAsked: true });
    assert.deepEqual(steps({ prefs: asked, platform: android }), ["android_install"]);
    assert.deepEqual(steps({ prefs: asked, platform: android, seen: { ...unseen, androidInstall: true } }), []);
    assert.deepEqual(steps({ prefs: asked, platform: { ...android, standalone: true } }), []);
    assert.deepEqual(steps({ platform: android }), ["study_time", "push"]);
  });

  it("canAskPush needs a usable server key", () => {
    assert.equal(canAskPush(prefs({ vapidPublicKey: null }), desktop), false);
    assert.equal(canAskPush(prefs({ vapidPublicKey: "BAbc" }), desktop), false);
    assert.equal(canAskPush(prefs(), desktop), true);
    assert.equal(canAskPush(prefs(), iosSafari), false);
    assert.equal(isUsableVapidKey(VAPID), true);
    assert.equal(isUsableVapidKey(`${VAPID}=`), false);
  });
});

describe("nextHabitStep: one step at a time", () => {
  it("answering the study time moves on to the push offer", () => {
    assert.equal(nextHabitStep(["study_time", "push"], 0, "answered"), 1);
    assert.equal(nextHabitStep(["study_time"], 0, "answered"), null);
  });

  it("a 'not now' on the study time ends the sheet: no second ask after a no", () => {
    assert.equal(nextHabitStep(["study_time", "push"], 0, "dismissed"), null);
    assert.equal(nextHabitStep(["study_time", "ios_install"], 0, "dismissed"), null);
  });

  it("the last step closes it either way", () => {
    assert.equal(nextHabitStep(["study_time", "push"], 1, "answered"), null);
    assert.equal(nextHabitStep(["push"], 0, "dismissed"), null);
  });
});

describe("study time helpers", () => {
  it("maps presets both ways", () => {
    assert.equal(presetFor(STUDY_TIME_PRESETS.evening), "evening");
    assert.equal(presetFor(19 * 60 + 15), null);
    assert.equal(presetFor(null), null);
  });

  it("parses time inputs and snaps to 15 minutes", () => {
    assert.equal(timeInputToMinute("19:00"), 1140);
    assert.equal(timeInputToMinute("07:08"), 435);
    assert.equal(timeInputToMinute("23:59"), 1425);
    assert.equal(timeInputToMinute("25:00"), null);
    assert.equal(timeInputToMinute(""), null);
    assert.equal(minuteToTimeInput(435), "07:15");
  });

  it("formats in the UI locale", () => {
    assert.equal(formatStudyTime(1140, "en-US"), "7 PM");
    assert.equal(formatStudyTime(1140, "de"), "19 Uhr");
    assert.equal(formatStudyTime(1170, "en-US"), "7:30 PM");
  });

  it("a good session is mostly right, or had nothing to score", () => {
    assert.equal(isGoodSession(0.8, 5), true);
    assert.equal(isGoodSession(0.4, 5), false);
    assert.equal(isGoodSession(null, 3), true);
    assert.equal(isGoodSession(1, 0), false);
  });

  it("decodes the VAPID key", () => {
    assert.deepEqual(Array.from(urlBase64ToUint8Array("AQID_w")), [1, 2, 3, 255]);
  });
});

it("the habit prompt's study time places the planner window, but never over the student's own", () => {
  const fresh = { windowStart: "15:00", windowEnd: "19:00", availability: null };
  assert.deepEqual(plannerWindowFromStudyTime(fresh, 17 * 60), { windowStart: "17:00", windowEnd: "19:00" });
  assert.deepEqual(plannerWindowFromStudyTime(fresh, 22 * 60 + 30), { windowStart: "22:30", windowEnd: "23:59" });
  assert.equal(plannerWindowFromStudyTime({ ...fresh, windowStart: "16:00" }, 17 * 60), null, "own window kept");
  assert.equal(plannerWindowFromStudyTime({ ...fresh, availability: [{ weekday: 1, start: "16:00", end: "18:00" }] }, 17 * 60), null, "own free times kept");
});

describe("deviceSeenFor: install hints come back when the user agent changes", () => {
  const iphone17 = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
  const iphone18 = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1";
  const pixel = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36";

  it("keeps the markers on the same user agent", () => {
    assert.deepEqual(deviceSeenFor({ iosInstallHint: true, ua: iphone17 }, iphone17), { iosInstallHint: true, androidInstall: false });
  });

  it("clears them when the user agent changed, so the hint is offered again", () => {
    assert.deepEqual(deviceSeenFor({ iosInstallHint: true, ua: iphone17 }, iphone18), unseen);
    assert.deepEqual(deviceSeenFor({ androidInstall: true, ua: iphone17 }, pixel), unseen);
    const seen = deviceSeenFor({ iosInstallHint: true, ua: iphone17 }, iphone18);
    assert.deepEqual(habitSteps({ prefs: prefs(), platform: iosSafari, seen, goodSession: true, now: NOW }), ["study_time", "ios_install"]);
  });

  it("treats markers saved without a user agent, or nothing saved, as unseen", () => {
    assert.deepEqual(deviceSeenFor({ iosInstallHint: true, androidInstall: true }, pixel), unseen);
    assert.deepEqual(deviceSeenFor(null, pixel), unseen);
  });
});
