/**
 * Trusted-number registry.
 *
 * DEMO SEED ONLY. Replace `SEED` with a real datastore before any pilot:
 *  - law_enforcement  -> state/county non-emergency directories
 *  - healthcare       -> CMS NPPES + hospital main lines
 *  - government       -> SSA / IRS / Medicare published numbers
 *  - financial        -> the number printed on the back of the card
 *  - fraud list       -> FTC Consumer Sentinel, FCC robocall complaints
 *
 * The verdict logic below is the part that stays; only the lookup changes.
 */
import type { z } from "zod";
import type { CallerCategory, RegistryMatch } from "@/lib/schema";
import { getSpamReport } from "@/lib/store";

type Category = z.infer<typeof CallerCategory>;
type Match = z.infer<typeof RegistryMatch> & { officialCallbackNumber?: string };

const SEED: Record<string, Match> = {
  "+14155530100": {
    name: "San Francisco Police Department — non-emergency",
    category: "law_enforcement",
    source: "demo_seed",
    sourceUrl: "https://www.sanfranciscopolice.org/",
    officialCallbackNumber: "+14155530123",
  },
  "+16505550111": {
    name: "Stanford Health Care — main line",
    category: "healthcare",
    source: "demo_seed",
    officialCallbackNumber: "+16505550111",
  },
  "+18005550199": {
    name: "Social Security Administration",
    category: "government",
    source: "demo_seed",
    officialCallbackNumber: "+18007721213",
  },
};

/**
 * Numbers seen in active fraud campaigns.
 *
 * Seed data only — the live counts come from `@/lib/store`, which households
 * write to when a call ends in a scam verdict. A number reported during one
 * call is flagged for every call after it.
 */
const FRAUD_LIST: Record<string, number> = {
  "+12025550147": 412,
  "+18885550123": 1879,
};

export type RegistryLookup = {
  match: Match | null;
  spamReportCount: number;
};

export async function lookupNumber(phoneNumber: string): Promise<RegistryLookup> {
  /*
   * The seed lists are plain constants and need no durable store, so a store
   * failure must not take number verification down with it.
   *
   * Reports filed by other households are the part that needs the database.
   * Lose them and the lookup is less informed, not broken.
   */
  let reportedCount = 0;
  try {
    reportedCount = (await getSpamReport(phoneNumber))?.reportCount ?? 0;
  } catch (cause) {
    console.error("[kinsight] spam report lookup failed, using seed data only", cause);
  }

  return {
    match: SEED[phoneNumber] ?? null,
    spamReportCount: (FRAUD_LIST[phoneNumber] ?? 0) + reportedCount,
  };
}

/**
 * Contacts integration placeholder.
 * TODO: wire to the device contact list (Web Contact Picker on mobile Safari /
 * Chrome, or an imported vCard) — the client should pass `inContacts` instead
 * once that lands, since contacts never leave the device.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isInContacts(phoneNumber: string): boolean {
  return false;
}

export function verdictFor(
  lookup: RegistryLookup,
  claimedCategory?: Category,
): "verified" | "mismatch" | "unknown" | "known_fraud" {
  if (lookup.spamReportCount > 0) return "known_fraud";
  if (!lookup.match) return "unknown";
  if (claimedCategory && claimedCategory !== lookup.match.category) return "mismatch";
  return "verified";
}
