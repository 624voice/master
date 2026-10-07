import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";
import { privacyPolicy } from "~/content/privacyPolicy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | 624 Voice" },
      {
        name: "description",
        content:
          "How 624 Voice collects and uses information from website visitors, demos, assessments, contact forms, and optional SMS consent.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return <LegalDocumentPage document={privacyPolicy} />;
}
