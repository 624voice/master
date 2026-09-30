/** Approved four-step client engagement process (Home + How We Work). */
export const CLIENT_ENGAGEMENT_STEPS = [
  {
    step: 1,
    title: "Diagnose the Leaks",
    body: "Understand how leads, customers, information, and routine work move through the business today. Identify the points where opportunities, time, or visibility are being lost.",
    deliverable: "Clear problem definition",
    noteUnderStep1:
      "If the real constraint is unclear or crosses several systems, the next step may be a paid AI Revenue and Operations Diagnostic.",
  },
  {
    step: 2,
    title: "Build the Roadmap",
    body: "Set the priorities, sequence, responsibilities, integrations, and measures of success before implementation begins.",
    deliverable: "Prioritized roadmap and scope",
  },
  {
    step: 3,
    title: "Connect the System",
    body: "Build the approved capabilities and connect them with the tools and processes worth keeping.",
    deliverable: "Approved systems working together",
  },
  {
    step: 4,
    title: "Prove and Improve",
    body: "Measure performance, improve the experience, and use regular reviews to decide what deserves attention next.",
    deliverable: "Measured results and next priorities",
  },
] as const;

export const HOW_WE_WORK_STEPS = [
  {
    step: 1,
    title: "Diagnose the Leaks",
    body: "We begin with a free AI Growth Systems Consultation focused on the result you want, how the work happens today, where friction is most visible, and which tools are already in place. If the real constraint is unclear or crosses several systems, we may recommend a paid AI Revenue and Operations Diagnostic before anything is built.",
    deliverable: "Recommended next step or deeper Diagnostic",
    trustHighlight:
      "You keep the roadmap whether or not you choose 624 Voice for implementation.",
  },
  {
    step: 2,
    title: "Build the Roadmap",
    body: "Whether the work begins with a focused consultation or a deeper Diagnostic, you receive a prioritized plan that explains what to fix first, why it matters, what it depends on, and how success will be measured.",
    deliverable: "Prioritized roadmap and focused scope",
    trustHighlight:
      "You keep the roadmap whether or not you choose 624 Voice for implementation.",
  },
  {
    step: 3,
    title: "Connect the System",
    body: "We build the approved capabilities and connect them with the tools and processes worth keeping. Work is implemented in clear modules, reviewed as it progresses, and launched against agreed criteria.",
    deliverable: "Approved systems working together",
  },
  {
    step: 4,
    title: "Prove and Improve",
    body: "After launch, we measure performance, improve the experience, and use regular reviews to connect operational changes with business results. Quarterly reviews help determine the next priority.",
    deliverable: "Performance review and next priorities",
  },
] as const;
