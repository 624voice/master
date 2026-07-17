import type { LegalDocument } from "~/components/LegalDocumentPage";

export const smsTerms: LegalDocument = {
  title: "SMS Campaign Terms & Conditions",
  badge: "Terms & Conditions",
  effectiveDate: "July 17, 2026",
  lastUpdated:
    "These Campaign Terms and Conditions were last updated on July 17, 2026.",
  sections: [
    {
      heading: "1. Program Overview",
      blocks: [
        {
          type: "paragraph",
          text: '624 Voice operates an SMS messaging program (the "Program") to send transactional appointment-related text messages to customers who schedule home services through 624voice.com or via our AI scheduling assistant. These Terms and Conditions govern participation in the Program.',
        },
      ],
    },
    {
      heading: "2. Campaign Description",
      blocks: [
        {
          type: "paragraph",
          text: "The 624 Voice SMS Program sends appointment confirmations and appointment reminders to customers who provide verbal consent during a live scheduling call with 624 Voice.",
        },
        {
          type: "paragraph",
          text: 'Opt-In Method: Verbal consent is obtained during a live scheduling call. Before any message is sent, the representative states:',
        },
        {
          type: "paragraph",
          text: '"May we send appointment confirmations, reminders, and scheduling updates to the mobile number you provided? Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help."',
          callout: true,
        },
        {
          type: "paragraph",
          text: "Messages are sent only after the customer clearly agrees. Consent is not a condition of purchase.",
        },
      ],
    },
    {
      heading: "3. Message Types & Sample Messages",
      blocks: [],
      subsections: [
        {
          heading: "Appointment Confirmation",
          blocks: [
            {
              type: "paragraph",
              text: "Sent immediately after a service appointment is booked.",
            },
            {
              type: "sample",
              label: "Sample message",
              text: "624 Voice: Your appointment is confirmed for [DAY, DATE] between [TIME WINDOW] at [SERVICE ADDRESS]. Reply STOP to opt out.",
            },
          ],
        },
        {
          heading: "Appointment Reminder",
          blocks: [
            {
              type: "paragraph",
              text: "Sent prior to a scheduled service visit.",
            },
            {
              type: "sample",
              label: "Sample message",
              text: "624 Voice reminder: Your service appointment is scheduled for [DAY, DATE] between [TIME WINDOW]. Please reply C to confirm or call us if you need to reschedule. Reply STOP to opt out.",
            },
          ],
        },
      ],
    },
    {
      heading: "4. Message Frequency",
      blocks: [
        {
          type: "paragraph",
          text: "Message frequency varies based on scheduling activity. Customers typically receive one (1) to two (2) messages per scheduled appointment — one confirmation and one reminder. Additional messages may be sent if appointment details change or further scheduling updates are required.",
        },
      ],
    },
    {
      heading: "5. Message & Data Rates",
      blocks: [
        {
          type: "paragraph",
          text: "Message and data rates may apply. Contact your wireless provider for details about your plan.",
        },
      ],
    },
    {
      heading: "6. How to Opt Out",
      blocks: [
        {
          type: "paragraph",
          text: "You may opt out of this Program at any time by replying STOP to any Program message. Upon receipt of your opt-out request:",
        },
        {
          type: "paragraph",
          text: "You will receive a single confirmation message acknowledging your opt-out.",
        },
        {
          type: "paragraph",
          text: "No further SMS messages will be sent to your mobile number.",
        },
        {
          type: "paragraph",
          text: "To re-enroll, you must provide verbal consent again during a future scheduling interaction with 624 Voice.",
        },
      ],
    },
    {
      heading: "7. How to Get Help",
      blocks: [
        {
          type: "paragraph",
          text: "Reply HELP to any Program message for assistance. You will receive a response with our contact information. You may also reach us directly:",
        },
        {
          type: "paragraph",
          text: "Email: info@624voice.com",
        },
        {
          type: "paragraph",
          text: "Website: 624voice.com",
        },
      ],
    },
    {
      heading: "8. Mobile Number Privacy",
      blocks: [
        {
          type: "paragraph",
          text: "Mobile opt-in data and consent — including mobile phone numbers — are collected solely for transactional appointment messaging.",
        },
        {
          type: "paragraph",
          text: "Phone numbers will NOT be shared with third parties for marketing purposes.",
          callout: true,
        },
        {
          type: "paragraph",
          text: "Mobile numbers are used exclusively to deliver the appointment-related messages described in these Terms. Number data is not sold, rented, or transferred to any third party for marketing or promotional use.",
        },
      ],
    },
    {
      heading: "9. Supported Carriers",
      blocks: [
        {
          type: "paragraph",
          text: "This Program is compatible with most major U.S. wireless carriers. 624 Voice and participating carriers are not liable for delayed or undelivered messages. Carrier message filtering may affect delivery in some cases.",
        },
      ],
    },
    {
      heading: "10. Program Eligibility",
      blocks: [
        {
          type: "paragraph",
          text: "The Program is available to customers of 624 Voice who provide a valid U.S. mobile phone number and grant verbal consent during a scheduling call. Participation is limited to individuals 18 years of age or older.",
        },
      ],
    },
    {
      heading: "11. Consent Not Required for Purchase",
      blocks: [
        {
          type: "paragraph",
          text: "Providing consent to receive SMS messages is not a condition of purchasing any service from 624 Voice. Customers may decline SMS messages without affecting their ability to schedule or receive services.",
        },
      ],
    },
    {
      heading: "12. Changes to This Program",
      blocks: [
        {
          type: "paragraph",
          text: "624 Voice reserves the right to modify or terminate this SMS Program at any time. Material changes will be reflected in an updated version of these Terms posted at 624voice.com.",
        },
      ],
    },
    {
      heading: "13. Contact Information",
      blocks: [
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
