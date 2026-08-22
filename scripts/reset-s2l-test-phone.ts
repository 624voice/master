#!/usr/bin/env bun
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";

const phone = process.argv[2];
if (!phone) {
  console.error("Usage: bun run scripts/reset-s2l-test-phone.ts +1XXXXXXXXXX");
  process.exit(1);
}

try {
  const result = await resetSpeed2LeadTestPhone(phone);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
