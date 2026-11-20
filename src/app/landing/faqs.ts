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
      ? "Right now every account has Pro for free: card payments are paused, so nobody is being charged. Normally Scribe is free to start (two subjects, three full sessions and a free Quick 5 every day), with Starter at $5/mo and Pro at $19/mo."
      : "Free to start, no card needed: two subjects, three full sessions and a free Quick 5 every day. Starter ($5/mo) and Pro ($19/mo) remove the limits. Or pay once: $29 until your 2027 exams, or $59 until graduation in 2028 — no subscription. See Pricing.",
  },
  {
    q: "I don't have a card. Can a parent pay?",
    a: "Yes. Pick a plan and tap “Ask a parent to pay”: you get a secure link to send by WhatsApp, Messages or email. They see what it's for, pay on our payment provider's page without making an account, and your account upgrades straight away. Both of you get an email. The link works once and expires after 14 days.",
  },
  {
    q: "Does the exam pass renew?",
    a: "No. A pass is one payment: you get Starter (600 tokens a month, refreshed monthly) until 15 July of your exam year, then you move back to the free plan and keep everything you made. We email you two weeks before it ends. Changed your mind? Full refund within 14 days — one click, from your receipt email or Settings.",
  },
];
