export {
  CONTACT_MAX_DISCOVERY_QUESTIONS as MAX_DISCOVERY_QUESTIONS,
  canAskDiscoveryQuestion,
  markDiscoveryQuestionAsked,
  closeDiscovery,
  shouldCloseDiscoveryFromInbound,
  shouldCloseDiscoveryFromModel,
  replyContainsQuestion,
  isConsequenceQuestion,
  looksLikeBridgeQuestion,
  discoveryRequirementsMet,
  shouldBlockDiscoveryReply,
  buildDiscoveryClosedFallback,
} from "~/server/speed2Lead/agent/discoveryGuard";
