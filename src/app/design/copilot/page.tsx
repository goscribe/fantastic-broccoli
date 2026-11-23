"use client";

import { Copilot } from "@/components/ai/copilot";

/**
 * Design preview of the session copilot with a Why? on a long question
 * (pinned at the top). Needs an API that answers /copilot/stream; /design is
 * a dev-only route.
 */
export default function CopilotPreview() {
  return (
    <div className="flex h-dvh justify-end bg-background">
      <div className="flex h-full w-full max-w-[420px] flex-col border-l border-border">
        <Copilot
          open
          onClose={() => {}}
          workspaceId="design"
          studySessionId="design-session"
          ask={{
            intent: "why",
            id: 1,
            label: "Why? Question 3",
            pinned:
              "Question 3 · A parcel classifier matches every labelled example it was trained on. It then predicts labels for new parcels whose correct labels are known. Determine which evaluation result shows the model has overfitted.",
          }}
        />
      </div>
    </div>
  );
}
