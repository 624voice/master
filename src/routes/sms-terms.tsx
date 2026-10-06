import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";
import { smsTerms } from "~/content/smsTerms";

export const Route = createFileRoute("/sms-terms")({
  head: () => ({
    meta: [
      { title: "SMS Terms & Conditions | 624 Voice" },
      {
        name: "description",
        content:
          "Optional SMS consent, message frequency, STOP/HELP, and data-use terms for 624 Voice website forms and scheduling assistance.",
      },
    ],
  }),
  component: SmsTermsPage,
});

function SmsTermsPage() {
  return <LegalDocumentPage document={smsTerms} />;
}
