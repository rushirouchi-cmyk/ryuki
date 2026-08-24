import {
  DEFAULT_AGENT_ROUTING_CONFIG,
  type AgentRoutingConfig,
} from '@/domain/config/agent-routing-config';

export interface AgentCandidateProfile {
  topOccupationIds: string[];
  regionId: string | null;
  desiredPrefectures: string[];
  estimatedSalaryHigh: number;
  experienceYears: number;
  hasManagementExperience: boolean;
}

export interface AgentCompanyRef {
  id: string;
  name: string;
  specialtyOccupationIds: string[];
  coverageRegionIds: string[];
  minSalaryFocus: number | null;
  maxSalaryFocus: number | null;
  active: boolean;
}

export interface AgentPerformance {
  agentCompanyId: string;
  referrals: number;
  joined: number;
}

export interface AgentRecommendation {
  agentCompanyId: string;
  agentName: string;
  score: number;
  breakdown: Record<string, number>;
  rankPosition: number;
}

function careerStageScore(profile: AgentCandidateProfile): number {
  // Mid-career candidates with management experience are the easiest to place.
  const experiencePart = Math.min(1, profile.experienceYears / 10);
  return Math.min(1, 0.6 * experiencePart + (profile.hasManagementExperience ? 0.4 : 0.2));
}

/**
 * Rule-based agent routing. Deliberately not a black box: every axis is
 * reported in `breakdown` so an operator can explain any ordering.
 */
export function recommendAgents(
  profile: AgentCandidateProfile,
  agents: AgentCompanyRef[],
  performance: AgentPerformance[],
  config: AgentRoutingConfig = DEFAULT_AGENT_ROUTING_CONFIG,
): AgentRecommendation[] {
  const perfByAgent = new Map(performance.map((p) => [p.agentCompanyId, p]));
  const w = config.weights;
  const weightTotal =
    w.specialtyOccupation + w.region + w.salaryBand + w.careerStage + w.historicalPerformance;

  const scored = agents
    .filter((agent) => agent.active)
    .map((agent) => {
      const specialtyHits = profile.topOccupationIds.filter((id) =>
        agent.specialtyOccupationIds.includes(id),
      ).length;
      const specialtyRatio =
        profile.topOccupationIds.length > 0 ? specialtyHits / profile.topOccupationIds.length : 0;

      const regionRatio =
        agent.coverageRegionIds.length === 0
          ? 0.5
          : profile.regionId && agent.coverageRegionIds.includes(profile.regionId)
            ? 1
            : 0.2;

      const min = agent.minSalaryFocus ?? 0;
      const max = agent.maxSalaryFocus ?? Number.POSITIVE_INFINITY;
      const salaryRatio =
        profile.estimatedSalaryHigh >= min && profile.estimatedSalaryHigh <= max ? 1 : 0.3;

      const stageRatio = careerStageScore(profile);

      const perf = perfByAgent.get(agent.id);
      const performanceRatio =
        !perf || perf.referrals < config.performanceMinSampleSize
          ? 0.5 // not enough data — neutral, never penalised into invisibility
          : Math.min(1, perf.joined / perf.referrals / config.performanceJoinRateCeiling);

      const breakdown = {
        specialtyOccupation: Math.round(specialtyRatio * w.specialtyOccupation * 10) / 10,
        region: Math.round(regionRatio * w.region * 10) / 10,
        salaryBand: Math.round(salaryRatio * w.salaryBand * 10) / 10,
        careerStage: Math.round(stageRatio * w.careerStage * 10) / 10,
        historicalPerformance: Math.round(performanceRatio * w.historicalPerformance * 10) / 10,
      };

      const raw =
        specialtyRatio * w.specialtyOccupation +
        regionRatio * w.region +
        salaryRatio * w.salaryBand +
        stageRatio * w.careerStage +
        performanceRatio * w.historicalPerformance;

      return {
        agentCompanyId: agent.id,
        agentName: agent.name,
        score: weightTotal > 0 ? Math.round((raw / weightTotal) * 100) : 0,
        breakdown,
        rankPosition: 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxRecommendations);

  return scored.map((item, index) => ({ ...item, rankPosition: index + 1 }));
}
