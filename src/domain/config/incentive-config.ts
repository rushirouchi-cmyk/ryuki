import { z } from 'zod';

export const incentiveConfigSchema = z.object({
  /** bonus target shown on the sales dashboard */
  monthlyBonus: z.object({
    eventType: z.string(),
    targetCount: z.number().int().min(1),
    bonusAmount: z.number().int().min(0),
  }),
  /** ledger rows are created with this status */
  defaultStatus: z.enum(['pending', 'approved']),
});

export type IncentiveConfig = z.infer<typeof incentiveConfigSchema>;

export const DEFAULT_INCENTIVE_CONFIG: IncentiveConfig = {
  monthlyBonus: { eventType: 'interview_completed', targetCount: 20, bonusAmount: 30_000 },
  defaultStatus: 'pending',
};
