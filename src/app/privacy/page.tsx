"use client";

import { LegalSection, MarketingPage } from "@/components/layout/marketing-page";

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy policy" updated="November 2026">
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
          We also keep an audit log of account and subject actions — what
          happened, when, the route involved, and the originating IP address —
          to secure accounts, debug failures, and investigate abuse.
        </p>
      </LegalSection>
      <LegalSection heading="How we use your data">
        <p>
          Your uploads are used solely to build your study materials: parsing
          documents, transcribing audio, and generating readings, worksheets,
          flashcards, study guides, and podcast episodes for your subjects.
          Material content is sent to AI model providers to perform this
          generation. We do not sell your data or use your materials to train
          models.
        </p>
      </LegalSection>
      <LegalSection heading="Google Calendar (optional)">
        <p>
          You can connect Google Calendar in the Planner so study time is
          planned around your day. Scribe asks Google for read-only access to
          your calendar events and for your Google account email address. It
          cannot create, change, or delete anything in your calendar.
        </p>
        <p>
          <strong>What we read.</strong> Events on your primary calendar for
          the week shown in the Planner and for the next three weeks: each
          event&apos;s title, start and end time, status, and whether it is
          marked busy or free. We do not request descriptions, guests,
          locations, or attachments.
        </p>
        <p>
          <strong>How we use it.</strong> Event times keep study blocks out of
          your busy hours. Event titles are checked for words such as
          &quot;exam&quot;, &quot;quiz&quot;, or &quot;deadline&quot;; when one
          is found, the Planner adds prep blocks before it and leaves you a
          note and a notification that quote the event title.
        </p>
        <p>
          <strong>AI processing.</strong> To arrange your week, and when you
          chat with the Planner, the titles and times of that week&apos;s
          events are sent to the AI model provider that generates the plan or
          the reply.
        </p>
        <p>
          <strong>What we store.</strong> Your Google account email and the
          access credentials Google issues, so the Planner can keep reading
          your events. We do not keep a copy of your calendar. We do keep
          things made from it: the generated week plan (which can mention
          events by name), a record of which events have already been handled
          (date and title), the prep blocks, and the notes and notifications
          described above.
        </p>
        <p>
          <strong>Disconnecting.</strong> When you disconnect in the Planner we
          ask Google to revoke Scribe&apos;s access and delete the stored
          credentials. Revoking removes every permission you gave Scribe on
          that Google account, so Google may ask you to approve Scribe again
          the next time you sign in with Google. If Google does not confirm
          the revoke, we tell you and link to your Google Account permissions
          page so you can remove access there. We also delete the cached week
          plans and the record of handled events, delete the notes and
          notifications created from your events, and rename the prep blocks
          to &quot;Prep session&quot; while keeping their time.
        </p>
        <p>
          <strong>What disconnecting does not remove.</strong> Your chat
          history with the Planner, which can mention events, and prep blocks
          or notes created from your calendar before we began labelling them
          as calendar-made, which we cannot tell apart from ones you made
          yourself. You can remove any block in the Planner, and deleting your
          account removes all of it.
        </p>
      </LegalSection>
      <LegalSection heading="Quality review by our team">
        <p>
          Because study content is AI-generated, authorised Scribe staff can
          access subjects and the content generated in them through an
          internal admin console. We use this to check generation quality,
          debug failed or low-quality output, curate content that is inaccurate
          or unsafe, respond to support requests, and investigate abuse. Access
          is restricted to staff who need it and is limited to those purposes;
          we do not read your materials for advertising or model training.
        </p>
      </LegalSection>
      <LegalSection heading="Sharing">
        <p>
          Content in a subject is visible to the people you share that subject with.
          You control who is invited. We share data with service providers only
          as needed to run Scribe (hosting, storage, AI generation, email, and
          payments), and with authorities where we are legally required to.
        </p>
      </LegalSection>
      <LegalSection heading="Retention and deletion">
        <p>
          You can delete uploaded materials, generated study guides, and other
          content from your subjects at any time; deleted files are also
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
