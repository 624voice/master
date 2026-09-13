/** Default source (IP fingerprint) rate limit: 30 submissions per hour. */
export const ASSESSMENT_SOURCE_RATE_LIMIT = 30;

/** Default phone rate limit: 5 submissions per 24 hours. */
export const ASSESSMENT_PHONE_RATE_LIMIT = 5;

export const ASSESSMENT_SOURCE_WINDOW_SECONDS = 60 * 60;

export const ASSESSMENT_PHONE_WINDOW_SECONDS = 60 * 60 * 24;

export const ASSESSMENT_RATE_LIMIT_KEY_PREFIX = "assessment:rate:";
