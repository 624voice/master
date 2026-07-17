import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";
import { smsTerms } from "~/content/smsTerms";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return <LegalDocumentPage document={smsTerms} />;
}
