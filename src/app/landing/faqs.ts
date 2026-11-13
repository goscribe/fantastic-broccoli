import { BILLING_PAUSED } from "@/lib/billing-paused";

export const faqs = [
  {
    q: "What can I upload?",
    a: "Textbook PDFs, lecture slides, notes and handouts, and audio recordings of lectures. Scribe parses text, figures, and diagrams, and transcribes audio automatically.",
  },
  {
    q: "Where do the questions come from?",
    a: "From your own materials. Scribe prioritises questions extracted from your uploaded guides and past papers, and calibrates generated questions to the difficulty of what you upload.",
  },
  {
    q: "Does it work for maths and physics?",
    a: "Yes — sessions include multi-step calculations with units, symbolic manipulation, derivations, and graph interpretation, all rendered with proper mathematical notation.",
  },
  {
    q: "How are my notes organised?",
    a: "By subject. Make one subject per course, drop your materials in, and every study session Scribe builds for that course lives inside it. No nested folders.",
  },
  {
    q: "How does the planner work?",
    a: "Tell Scribe when you are free, or connect Google Calendar, and it slots study times into your week around school. You can drag them, draw new ones, or drop notes onto a slot to build that session. New tests on your calendar get prep sessions added before them.",
  },
  {
    q: "What counts towards my streak?",
    a: "A day counts when you hit your daily goal (20 minutes unless you change it). If the day is nearly over and you have not, you get one reminder in the evening.",
  },
  {
    q: "Is my data private?",
    a: "Your uploads stay in your subjects and are only used to build your study materials. You can delete materials and generated content at any time.",
  },
  {
    q: "How much does it cost?",
    a: BILLING_PAUSED
      ? "Right now every account has Pro for free: card payments are paused, so nobody is being charged. Normally Scribe is free to start (one subject, one full session and a free Quick 5 every day), with Starter at $9/mo and Pro at $19/mo."
      : "Free to start, no card needed: one subject, one full session and a free Quick 5 every day. Starter ($9/mo) and Pro ($19/mo) remove the limits — see Pricing.",
  },
];
