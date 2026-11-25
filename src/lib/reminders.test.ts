import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  plannerWindowFromStudyTime,
  STUDY_TIME_PRESETS,
  canAskPush,
  deviceSeenFor,
  formatStudyTime,
  habitSteps,
  isGoodSession,
  minuteToTimeInput,
  presetFor,
  timeInputToMinute,
  urlBase64ToUint8Array,
  type Platform,
  type ReminderPrefs,
} from "./reminders";

const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({
  studyReminderMinute: null,
  studyTimeAsked: false,
  pushAsked: false,
  pushAvailable: true,
  vapidPublicKey: "BAbc",
  pushDevices: 0,
  timezone: "Europe/Berlin",
  ...over,
});
const desktop: Platform = { ios: false, standalone: false, pushSupported: true, permission: "default", canInstall: false };
const iosSafari: Platform = { ios: true, standalone: false, pushSupported: false, permission: "unsupported", canInstall: false };
const iosHome: Platform = { ios: true, standalone: true, pushSupported: true, permission: "default", canInstall: false };
const android: Platform = { ios: false, standalone: false, pushSupported: true, permission: "default", canInstall: true };
const unseen = { iosInstallHint: false, androidInstall: false };

describe("habitSteps: what to ask after a Quick 5", () => {
  it("asks the study time, then the push soft-ask, on a browser that can push", () => {
    assert.deepEqual(habitSteps({ prefs: prefs(), platform: desktop, seen: unseen, goodSession: true }), ["study_time", "push"]);
  });

  it("asks each question only once per account", () => {
    assert.deepEqual(habitSteps({ prefs: prefs({ studyTimeAsked: true }), platform: desktop, seen: unseen, goodSession: true }), ["push"]);
    assert.deepEqual(
      habitSteps({ prefs: prefs({ studyTimeAsked: true, pushAsked: true }), platform: desktop, seen: unseen, goodSession: true }),
      [],
    );
  });

  it("never shows the soft-ask when the browser already decided or push is off on the server", () => {
    const asked = prefs({ studyTimeAsked: true });
    assert.deepEqual(habitSteps({ prefs: asked, platform: { ...desktop, permission: "denied" }, seen: unseen, goodSession: true }), []);
    assert.deepEqual(habitSteps({ prefs: asked, platform: { ...desktop, permission: "granted" }, seen: unseen, goodSession: true }), []);
    assert.deepEqual(habitSteps({ prefs: prefs({ studyTimeAsked: true, pushAvailable: false }), platform: desktop, seen: unseen, goodSession: true }), []);
  });

  it("on iOS Safari shows the Add to Home Screen hint instead (push needs the installed app), after a good session, once", () => {
    assert.deepEqual(habitSteps({ prefs: prefs(), platform: iosSafari, seen: unseen, goodSession: true }), ["study_time", "ios_install"]);
    assert.deepEqual(habitSteps({ prefs: prefs(), platform: iosSafari, seen: unseen, goodSession: false }), ["study_time"]);
    assert.deepEqual(
      habitSteps({ prefs: prefs(), platform: iosSafari, seen: { ...unseen, iosInstallHint: true }, goodSession: true }),
      ["study_time"],
    );
  });

  it("in the home-screen app on iOS asks for push like anywhere else", () => {
    assert.deepEqual(habitSteps({ prefs: prefs({ studyTimeAsked: true }), platform: iosHome, seen: unseen, goodSession: true }), ["push"]);
  });

  it("on Android Chrome offers install once push was asked", () => {
    const asked = prefs({ studyTimeAsked: true, pushAsked: true });
    assert.deepEqual(habitSteps({ prefs: asked, platform: android, seen: unseen, goodSession: true }), ["android_install"]);
    assert.deepEqual(habitSteps({ prefs: asked, platform: android, seen: { ...unseen, androidInstall: true }, goodSession: true }), []);
    assert.deepEqual(habitSteps({ prefs: asked, platform: { ...android, standalone: true }, seen: unseen, goodSession: true }), []);
    // Push first: never more than two sheets in one visit.
    assert.deepEqual(habitSteps({ prefs: prefs(), platform: android, seen: unseen, goodSession: true }), ["study_time", "push"]);
  });

  it("canAskPush needs a server key", () => {
    assert.equal(canAskPush(prefs({ vapidPublicKey: null }), desktop), false);
    assert.equal(canAskPush(prefs(), iosSafari), false);
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
    assert.deepEqual(habitSteps({ prefs: prefs(), platform: iosSafari, seen, goodSession: true }), ["study_time", "ios_install"]);
  });

  it("treats markers saved without a user agent, or nothing saved, as unseen", () => {
    assert.deepEqual(deviceSeenFor({ iosInstallHint: true, androidInstall: true }, pixel), unseen);
    assert.deepEqual(deviceSeenFor(null, pixel), unseen);
  });
});
