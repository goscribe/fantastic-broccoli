"use client";

import { useEffect } from "react";
import { progressStore } from "@/lib/notes-public/progress";
import { readingStore, topicState } from "@/lib/notes-public/reading";

/**
 * Lights up a visitor's own progress on the index, course and unit pages from
 * what is already in localStorage (sections read, questions answered): topic
 * nodes on the path ([data-nl-topic="course/topic"]) get a state, and course
 * meters ([data-nl-course="course"]) fill. Server HTML is the "nothing yet"
 * state with the same dimensions, so nothing shifts.
 */
export function NotesProgress() {
  useEffect(() => {
    const reading = readingStore.read().topics;
    const practice = progressStore.read().topics;
    const answered = (key: string) => Object.keys(practice[key]?.answers ?? {}).length;
    document.querySelectorAll<HTMLElement>("[data-nl-topic]").forEach((el) => {
      const key = el.dataset.nlTopic ?? "";
      const state = topicState(reading[key], answered(key), Number(el.dataset.q) || 0);
      if (state !== "new") el.dataset.state = state;
    });
    const keys = new Set([...Object.keys(reading), ...Object.keys(practice)]);
    document.querySelectorAll<HTMLElement>("[data-nl-course]").forEach((el) => {
      const course = el.dataset.nlCourse ?? "";
      const total = Number(el.dataset.total) || 0;
      const started = [...keys].filter((k) => k.startsWith(`${course}/`) && topicState(reading[k], answered(k), 0) !== "new").length;
      if (!started || !total) return;
      el.querySelector<HTMLElement>(".nl-meter")?.style.setProperty("--v", String(Math.min(1, started / total)));
      const label = el.querySelector<HTMLElement>("[data-nl-count]");
      if (label) label.textContent = `${started} of ${total} topics started`;
    });
  }, []);
  return null;
}
