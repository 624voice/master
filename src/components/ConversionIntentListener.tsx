import { useEffect } from "react";
import { installConversionIntentCollector } from "~/lib/analytics/conversionIntent";

export function ConversionIntentListener() {
  useEffect(() => installConversionIntentCollector(), []);
  return null;
}
