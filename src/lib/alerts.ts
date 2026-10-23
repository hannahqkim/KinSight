import type { RiskLevel } from "@/lib/schema";

/** Keep alert behavior consistent across every API consumer. */
export function shouldAlertForRisk(riskLevel: RiskLevel): boolean {
  return riskLevel === "likely_fraud" || riskLevel === "critical";
}
