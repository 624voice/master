import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";
import { termsOfUse } from "~/content/termsOfUse";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | 624 Voice" },
      {
        name: "description",
        content: "Terms governing use of the 624 Voice website and self-service tools.",
      },
    ],
  }),
  component: Terms,
});

function Terms() {
  return <LegalDocumentPage document={termsOfUse} />;
}
