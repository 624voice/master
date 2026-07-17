import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";
import { privacyPolicy } from "~/content/privacyPolicy";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  return <LegalDocumentPage document={privacyPolicy} />;
}
