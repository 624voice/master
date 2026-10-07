import type { LegalDocument } from "~/components/LegalDocumentPage";

/** General website terms — owner/legal review required before production. */
export const termsOfUse: LegalDocument = {
  title: "Terms of Use",
  badge: "Legal",
  effectiveDate: "October 6, 2026",
  lastUpdated:
    "These Terms of Use were last updated on October 6, 2026. Marked for owner and legal review before production use.",
  sections: [
    {
      heading: "1. Acceptance",
      blocks: [
        {
          type: "paragraph",
          text: "By accessing 624voice.com (the “Site”), you agree to these Terms of Use and our Privacy Policy. If you do not agree, do not use the Site.",
        },
      ],
    },
    {
      heading: "2. Informational purpose",
      blocks: [
        {
          type: "paragraph",
          text: "Site content describes 624 Voice capabilities and tools for home-service businesses. Calculators, assessments, demos, and forms provide directional information only. They do not create a binding contract, guarantee results, or replace professional advice.",
        },
      ],
    },
    {
      heading: "3. Acceptable use",
      blocks: [
        {
          type: "paragraph",
          text: "You may use the Site for lawful business evaluation. You may not attempt to disrupt the Site, scrape or overload systems, submit false information, or use tools in ways that violate applicable law or third-party rights.",
        },
      ],
    },
    {
      heading: "4. Communications and consent",
      blocks: [
        {
          type: "paragraph",
          text: "Optional SMS checkboxes on demo, assessment, and contact forms are separate from form submission. We send automated text messages only when you check the optional SMS consent box. Email and phone details you provide may be used to respond to your inquiry as described in the Privacy Policy and SMS Terms & Conditions.",
        },
      ],
    },
    {
      heading: "5. Third-party services",
      blocks: [
        {
          type: "paragraph",
          text: "Scheduling, voice demo, analytics, hosting, and messaging may rely on third-party providers. Their terms and privacy practices may apply when you use those features.",
        },
      ],
    },
    {
      heading: "6. Disclaimer",
      blocks: [
        {
          type: "paragraph",
          text: "The Site is provided “as is” without warranties of any kind, to the fullest extent permitted by law. 624 Voice disclaims implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
        },
      ],
    },
    {
      heading: "7. Limitation of liability",
      blocks: [
        {
          type: "paragraph",
          text: "To the fullest extent permitted by law, 624 Voice is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the Site.",
        },
      ],
    },
    {
      heading: "8. Changes",
      blocks: [
        {
          type: "paragraph",
          text: "We may update these Terms of Use. Continued use after changes are posted constitutes acceptance of the revised terms.",
        },
      ],
    },
    {
      heading: "9. Contact",
      blocks: [
        {
          type: "paragraph",
          text: "Questions about these terms: info@624voice.com.",
        },
      ],
    },
  ],
};
