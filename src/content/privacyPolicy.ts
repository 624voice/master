import type { LegalDocument } from "~/components/LegalDocumentPage";

export const privacyPolicy: LegalDocument = {
  title: "Privacy Policy",
  badge: "Privacy",
  effectiveDate: "July 17, 2026",
  lastUpdated: "This Privacy Policy was last updated on July 17, 2026.",
  sections: [
    {
      heading: "1. Introduction",
      blocks: [
        {
          type: "paragraph",
          text: '624 Voice ("we," "us," or "our") is committed to protecting the privacy of our customers and website visitors. This Privacy Policy describes how we collect, use, disclose, and safeguard information obtained through 624voice.com and in connection with our voice AI appointment scheduling services.',
        },
        {
          type: "paragraph",
          text: "By using our services or visiting our website, you consent to the practices described in this Privacy Policy.",
        },
      ],
    },
    {
      heading: "2. Information We Collect",
      blocks: [],
      subsections: [
        {
          heading: "Personal Information",
          blocks: [
            {
              type: "paragraph",
              text: "We may collect the following categories of personal information:",
            },
            {
              type: "paragraph",
              text: "Name, phone number, email address, and service address",
            },
            {
              type: "paragraph",
              text: "Appointment details including scheduled dates, times, and service types",
            },
            {
              type: "paragraph",
              text: "Communications with our AI scheduling assistant",
            },
            {
              type: "paragraph",
              text: "Payment information, processed securely through third-party payment processors",
            },
          ],
        },
        {
          heading: "Automatically Collected Information",
          blocks: [
            {
              type: "paragraph",
              text: "When you visit 624voice.com we may automatically collect device identifiers, browser type, IP address, and usage data through standard web technologies such as cookies and log files.",
            },
          ],
        },
      ],
    },
    {
      heading: "3. SMS / Text Messaging — Mobile Number Data",
      blocks: [
        {
          type: "paragraph",
          text: "We collect mobile phone numbers solely to send transactional appointment confirmations, reminders, and scheduling updates to customers who have explicitly provided verbal consent during a scheduling call.",
        },
        {
          type: "paragraph",
          text: "IMPORTANT: Mobile opt-in data and consent — including mobile phone numbers collected for SMS communications — will NOT be shared with, sold to, or used by third parties for marketing purposes.",
          callout: true,
        },
        {
          type: "paragraph",
          text: "Mobile numbers collected in connection with our SMS program are used exclusively to deliver the appointment-related messages described in this policy.",
        },
      ],
    },
    {
      heading: "4. How We Use Your Information",
      blocks: [
        {
          type: "paragraph",
          text: "We use the information we collect for the following purposes:",
        },
        {
          type: "paragraph",
          text: "Scheduling, confirming, and reminding you of service appointments",
        },
        {
          type: "paragraph",
          text: "Sending transactional SMS messages to opted-in mobile numbers",
        },
        {
          type: "paragraph",
          text: "Responding to your inquiries and customer service requests",
        },
        {
          type: "paragraph",
          text: "Improving our AI assistant and internal service operations",
        },
        {
          type: "paragraph",
          text: "Complying with applicable laws and regulations",
        },
      ],
    },
    {
      heading: "5. SMS Messaging Program Disclosures",
      blocks: [],
      subsections: [
        {
          heading: "Message Types",
          blocks: [
            {
              type: "paragraph",
              text: "We send the following types of text messages to customers who have opted in:",
            },
            {
              type: "paragraph",
              text: "Appointment Confirmation — sent when a service appointment is booked",
            },
            {
              type: "paragraph",
              text: "Appointment Reminder — sent prior to a scheduled service visit",
            },
            {
              type: "paragraph",
              text: "Scheduling Updates — sent when appointment details change",
            },
          ],
        },
        {
          heading: "Message Frequency",
          blocks: [
            {
              type: "paragraph",
              text: "Message frequency varies based on scheduling activity. Customers typically receive one (1) to two (2) messages per scheduled appointment — one confirmation and one reminder. Additional messages may be sent if scheduling changes occur.",
            },
            {
              type: "paragraph",
              text: "Message and data rates may apply. Contact your wireless carrier for details.",
            },
          ],
        },
        {
          heading: "How to Opt Out",
          blocks: [
            {
              type: "paragraph",
              text: "Reply STOP to any message at any time to unsubscribe from all SMS communications. After opting out, you will receive a single confirmation message and no further messages will be sent to your number.",
            },
          ],
        },
        {
          heading: "How to Get Help",
          blocks: [
            {
              type: "paragraph",
              text: "Reply HELP to any message for assistance, or contact us at info@624voice.com. Additional support is available at 624voice.com.",
            },
          ],
        },
      ],
    },
    {
      heading: "6. How We Share Information",
      blocks: [
        {
          type: "paragraph",
          text: "We do not sell, trade, or rent your personal information. We may share information only in the following limited circumstances:",
        },
        {
          type: "paragraph",
          text: "Service Providers — Third-party vendors who assist us in operating our website or delivering services (such as cloud hosting or SMS delivery platforms), subject to confidentiality obligations. These providers are prohibited from using your data for any purpose other than providing services on our behalf.",
        },
        {
          type: "paragraph",
          text: "Legal Compliance — When required by law, court order, or regulatory authority.",
        },
        {
          type: "paragraph",
          text: "Business Transfers — In connection with a merger, acquisition, or sale of assets, subject to the successor honoring this Privacy Policy.",
        },
        {
          type: "paragraph",
          text: "We do not share your mobile phone number or SMS consent data with any third party for marketing or promotional purposes.",
        },
      ],
    },
    {
      heading: "7. Data Retention",
      blocks: [
        {
          type: "paragraph",
          text: "We retain personal information for as long as necessary to fulfill the purposes described in this policy or as required by law. Appointment records are generally retained for two (2) years. You may request deletion of your personal information by contacting us as described below.",
        },
      ],
    },
    {
      heading: "8. Data Security",
      blocks: [
        {
          type: "paragraph",
          text: "We implement reasonable administrative, technical, and physical safeguards to protect your information from unauthorized access, disclosure, or misuse. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.",
        },
      ],
    },
    {
      heading: "9. Children's Privacy",
      blocks: [
        {
          type: "paragraph",
          text: "Our services are not directed to individuals under the age of 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us immediately.",
        },
      ],
    },
    {
      heading: "10. Your Rights and Choices",
      blocks: [
        {
          type: "paragraph",
          text: "You may have rights under applicable law to access, correct, or delete your personal information. To exercise these rights, contact us at info@624voice.com. We will respond within a reasonable timeframe and in accordance with applicable law.",
        },
      ],
    },
    {
      heading: "11. Third-Party Links",
      blocks: [
        {
          type: "paragraph",
          text: "Our website may contain links to third-party sites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies independently.",
        },
      ],
    },
    {
      heading: "12. Changes to This Policy",
      blocks: [
        {
          type: "paragraph",
          text: "We reserve the right to update this Privacy Policy at any time. We will post the revised policy on this page with an updated effective date. Continued use of our services after changes are posted constitutes acceptance of the revised policy.",
        },
      ],
    },
    {
      heading: "13. Contact Us",
      blocks: [
        {
          type: "paragraph",
          text: "If you have questions about this Privacy Policy or our data practices, please contact us:",
        },
        {
          type: "paragraph",
          text: "Website: 624voice.com",
        },
        {
          type: "paragraph",
          text: "Support: info@624voice.com",
        },
        {
          type: "paragraph",
          text: "General: info@624voice.com",
        },
      ],
    },
  ],
};
