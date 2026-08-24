import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_MATCHING_CONFIG } from "@/lib/config/settings";
import { rankAgents, scoreAgent, type AgentProfile } from "@/lib/domain/agents/matching";

const config = DEFAULT_AGENT_MATCHING_CONFIG;

function agent(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    agentCompanyId: 1,
    name: "テストエージェント",
    specialties: new Map([[10, 5]]),
    regionIds: new Set([100]),
    minSalaryYen: 3_000_000,
    maxSalaryYen: 9_000_000,
    referralCount: 0,
    joinedCount: 0,
    ...overrides,
  };
}

const input = {
  targetOccupationIds: [10, 11],
  currentOccupationId: 1,
  desiredRegionIds: [100],
  currentRegionId: 100,
  estimatedSalaryYen: 5_500_000,
  experienceYears: 7,
  managementYears: 0,
};

describe("agent matching", () => {
  it("scores an agency that covers the recommended occupation and region highest", () => {
    const specialist = scoreAgent(agent(), input, config);
    const generalist = scoreAgent(
      agent({ agentCompanyId: 2, specialties: new Map(), regionIds: new Set([999]) }),
      input,
      config,
    );
    expect(specialist.score).toBeGreaterThan(generalist.score);
  });

  it("always explains why an agency was suggested", () => {
    const result = scoreAgent(agent(), input, config);
    expect(result.reasons.length).toBeGreaterThan(0);
    const empty = scoreAgent(
      agent({ specialties: new Map(), regionIds: new Set() }),
      input,
      config,
    );
    expect(empty.reasons.length).toBeGreaterThan(0);
  });

  it("shrinks an unproven placement rate towards the neutral rate", () => {
    const lucky = scoreAgent(
      agent({ referralCount: 1, joinedCount: 1 }),
      input,
      config,
    );
    const proven = scoreAgent(
      agent({
        referralCount: config.performanceSampleFloor * 2,
        joinedCount: config.performanceSampleFloor * 2,
      }),
      input,
      config,
    );
    expect(proven.components.performance).toBeGreaterThan(
      lucky.components.performance ?? 0,
    );
  });

  it("never shows more agencies than the configured maximum", () => {
    const agents = Array.from({ length: 12 }, (_, index) =>
      agent({ agentCompanyId: index + 1 }),
    );
    expect(rankAgents(agents, input, config)).toHaveLength(config.maxRecommendations);
  });

  it("orders results by score, breaking ties deterministically", () => {
    const results = rankAgents(
      [agent({ agentCompanyId: 3 }), agent({ agentCompanyId: 1 })],
      input,
      config,
    );
    expect(results[0]?.score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
    expect(results[0]?.agentCompanyId).toBe(1);
  });

  it("keeps every score inside 0-100", () => {
    for (const candidate of [
      agent(),
      agent({ specialties: new Map(), regionIds: new Set() }),
      agent({ minSalaryYen: 0, maxSalaryYen: 30_000_000 }),
    ]) {
      const result = scoreAgent(candidate, input, config);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });
});
