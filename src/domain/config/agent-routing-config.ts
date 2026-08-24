import { z } from 'zod';

export const agentRoutingConfigSchema = z.object({
  weights: z.object({
    specialtyOccupation: z.number().min(0).max(100),
    region: z.number().min(0).max(100),
    salaryBand: z.number().min(0).max(100),
    careerStage: z.number().min(0).max(100),
    historicalPerformance: z.number().min(0).max(100),
  }),
  /** how many agents the candidate may choose from */
  maxRecommendations: z.number().int().min(1).max(5),
  /** referrals needed before historical performance is trusted */
  performanceMinSampleSize: z.number().int().min(1),
  /** join rate treated as a perfect score */
  performanceJoinRateCeiling: z.number().min(0.01).max(1),
});

export type AgentRoutingConfig = z.infer<typeof agentRoutingConfigSchema>;

export const DEFAULT_AGENT_ROUTING_CONFIG: AgentRoutingConfig = {
  weights: {
    specialtyOccupation: 35,
    region: 20,
    salaryBand: 15,
    careerStage: 10,
    historicalPerformance: 20,
  },
  maxRecommendations: 5,
  performanceMinSampleSize: 5,
  performanceJoinRateCeiling: 0.3,
};
