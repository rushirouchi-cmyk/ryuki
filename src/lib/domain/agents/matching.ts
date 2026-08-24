import type { AgentMatchingConfig } from "@/lib/config/settings";

export interface AgentProfile {
  agentCompanyId: number;
  name: string;
  /** occupationId -> strength (1-5) */
  specialties: Map<number, number>;
  regionIds: Set<number>;
  minSalaryYen: number;
  maxSalaryYen: number;
  /** Historical referrals and joins, used for the performance component. */
  referralCount: number;
  joinedCount: number;
}

export interface AgentMatchInput {
  /** Occupations the diagnosis recommends, best first. */
  targetOccupationIds: number[];
  currentOccupationId: number;
  desiredRegionIds: number[];
  currentRegionId: number;
  estimatedSalaryYen: number | null;
  experienceYears: number;
  managementYears: number;
}

export interface AgentMatchResult {
  agentCompanyId: number;
  score: number;
  reasons: string[];
  components: Record<string, number>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Rule-based routing. Deliberately not a learned model: with no placement
 * history at launch there is nothing to learn from, and a candidate deserves to
 * be told *why* an agency was suggested before handing over their details.
 */
export function scoreAgent(
  agent: AgentProfile,
  input: AgentMatchInput,
  config: AgentMatchingConfig,
): AgentMatchResult {
  const reasons: string[] = [];

  /* Specialty: best strength across the recommended occupations, current job included. */
  const occupationIds = [input.currentOccupationId, ...input.targetOccupationIds];
  let bestStrength = 0;
  let bestOccupationId: number | null = null;
  for (const occupationId of occupationIds) {
    const strength = agent.specialties.get(occupationId) ?? 0;
    if (strength > bestStrength) {
      bestStrength = strength;
      bestOccupationId = occupationId;
    }
  }
  const specialty = clamp01(bestStrength / 5);
  if (bestOccupationId !== null && bestStrength >= 4) {
    reasons.push("推奨職種の紹介実績が豊富です");
  } else if (bestStrength > 0) {
    reasons.push("推奨職種を取り扱っています");
  }

  /* Region */
  const desired = input.desiredRegionIds.length > 0
    ? input.desiredRegionIds
    : [input.currentRegionId];
  const covered = desired.filter((regionId) => agent.regionIds.has(regionId));
  const region = desired.length === 0 ? 0 : covered.length / desired.length;
  if (region >= 1) reasons.push("希望勤務地すべてに対応しています");
  else if (region > 0) reasons.push("希望勤務地の一部に対応しています");

  /* Salary band */
  let salaryBand = 0.5;
  if (input.estimatedSalaryYen !== null) {
    if (
      input.estimatedSalaryYen >= agent.minSalaryYen &&
      input.estimatedSalaryYen <= agent.maxSalaryYen
    ) {
      salaryBand = 1;
      reasons.push("想定年収レンジの求人を多く扱っています");
    } else {
      const distance = Math.min(
        Math.abs(input.estimatedSalaryYen - agent.minSalaryYen),
        Math.abs(input.estimatedSalaryYen - agent.maxSalaryYen),
      );
      salaryBand = clamp01(1 - distance / 3_000_000);
    }
  }

  /* Career stage: management-heavy agencies suit candidates with more tenure. */
  const seniority = clamp01(
    (input.experienceYears / 15) * 0.6 + (input.managementYears / 5) * 0.4,
  );
  const agencySeniority = clamp01(agent.maxSalaryYen / 12_000_000);
  const careerStage = 1 - Math.abs(seniority - agencySeniority);

  /* Historical performance, shrunk towards the neutral rate on small samples. */
  const observed = agent.referralCount > 0 ? agent.joinedCount / agent.referralCount : 0;
  const weight = clamp01(agent.referralCount / config.performanceSampleFloor);
  const performance = clamp01(
    observed * weight + config.neutralPerformance * (1 - weight),
  );
  if (agent.referralCount >= config.performanceSampleFloor && observed >= 0.3) {
    reasons.push("これまでの入社決定率が高いエージェントです");
  }

  const weights = config.weights;
  const totalWeight =
    weights.specialty +
    weights.region +
    weights.salaryBand +
    weights.careerStage +
    weights.historicalPerformance;

  const score =
    totalWeight === 0
      ? 0
      : Math.round(
          ((specialty * weights.specialty +
            region * weights.region +
            salaryBand * weights.salaryBand +
            careerStage * weights.careerStage +
            performance * weights.historicalPerformance) /
            totalWeight) *
            100,
        );

  return {
    agentCompanyId: agent.agentCompanyId,
    score,
    reasons: reasons.length > 0 ? reasons : ["幅広い職種・地域に対応しています"],
    components: {
      specialty: Math.round(specialty * 100) / 100,
      region: Math.round(region * 100) / 100,
      salaryBand: Math.round(salaryBand * 100) / 100,
      careerStage: Math.round(careerStage * 100) / 100,
      performance: Math.round(performance * 100) / 100,
    },
  };
}

export function rankAgents(
  agents: readonly AgentProfile[],
  input: AgentMatchInput,
  config: AgentMatchingConfig,
): AgentMatchResult[] {
  return agents
    .map((agent) => scoreAgent(agent, input, config))
    .sort((a, b) => b.score - a.score || a.agentCompanyId - b.agentCompanyId)
    .slice(0, config.maxRecommendations);
}
