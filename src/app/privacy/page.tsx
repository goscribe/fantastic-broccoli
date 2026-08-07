"use client";

import { LegalSection, MarketingPage } from "@/components/layout/marketing-page";

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy policy" updated="August 2026">
      <LegalSection heading="What we collect">
        <p>
          When you create an account we collect your name, email address, and
          password (stored only as a hash) — or, if you sign in with Google,
          the basic profile details that provider shares with us. When you use
          Scribe we store the study materials you upload (PDFs, slides, notes,
          images, and audio recordings), the study content generated from them,
          and your study activity (session progress, answers, and chat messages
          with the copilot).
        </p>
        <p>
          We also keep an audit log of account and workspace actions — what
          happened, when, the route involved, and the originating IP address —
          to secure accounts, debug failures, and investigate abuse.
        </p>
      </LegalSection>
      <LegalSection heading="How we use your data">
        <p>
          Your uploads are used solely to build your study materials: parsing
          documents, transcribing audio, and generating readings, worksheets,
          flashcards, study guides, and podcast episodes for your workspaces.
          Material content is sent to AI model providers to perform this
          generation. We do not sell your data or use your materials to train
          models.
        </p>
      </LegalSection>
      <LegalSection heading="Quality review by our team">
        <p>
          Because study content is AI-generated, authorised Scribe staff can
          access workspaces and the content generated in them through an
          internal admin console. We use this to check generation quality,
          debug failed or low-quality output, curate content that is inaccurate
          or unsafe, respond to support requests, and investigate abuse. Access
          is restricted to staff who need it and is limited to those purposes;
          we do not read your materials for advertising or model training.
        </p>
      </LegalSection>
      <LegalSection heading="Sharing">
        <p>
          Content in a workspace is visible to that workspace&apos;s members.
          You control who is invited. We share data with service providers only
          as needed to run Scribe (hosting, storage, AI generation, email, and
          payments), and with authorities where we are legally required to.
        </p>
      </LegalSection>
      <LegalSection heading="Retention and deletion">
        <p>
          You can delete uploaded materials, generated study guides, and other
          content from your workspaces at any time; deleted files are also
          removed from storage. Deleting your account removes your personal
          data from our systems. Audit-log entries are kept for a limited
          retention window and then purged automatically; billing records are
          kept as long as tax and accounting law requires.
        </p>
      </LegalSection>
      <LegalSection heading="Your rights">
        <p>
          You can access and correct your profile in settings, export or delete
          your content, and request deletion of your account. Depending on
          where you live you may also have rights to a copy of your data or to
          object to certain processing — email us and we will help.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          Questions about this policy? Contact us at support@scribe.study.
        </p>
      </LegalSection>
    </MarketingPage>
  );
}
