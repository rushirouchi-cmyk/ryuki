export const EXPERIENCE_BANDS = ["0-2", "3-5", "6-9", "10-14", "15+"] as const;
export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number];

export const EDUCATION_LEVELS = [
  "high_school",
  "vocational",
  "associate",
  "bachelor",
  "master",
  "doctorate",
  "other",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EMPLOYMENT_TYPES = [
  "full_time",
  "contract",
  "dispatch",
  "part_time",
  "self_employed",
  "other",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export type ConfidenceLevel = "low" | "medium" | "high";
export type MatchRank = "S" | "A" | "B" | "C";

/** Normalised diagnosis input. The engine never touches the database. */
export interface CandidateProfile {
  currentOccupationId: number;
  currentSalaryYen: number;
  experienceYears: number;
  experienceBand: ExperienceBand;
  educationLevel: EducationLevel | null;
  employmentType: EmploymentType;
  managementYears: number;
  skillIds: number[];
  certificationIds: number[];
  currentRegionId: number;
  desiredRegionIds: number[];
  relocationOk: boolean;
  travelOk: boolean;
  nightShiftOk: boolean;
}

export interface OccupationRequirementLink {
  id: number;
  weight: number;
}

export interface OccupationMaster {
  id: number;
  name: string;
  category: string;
  requiresTravel: boolean;
  requiresNightShift: boolean;
  requiresRelocation: boolean;
  minEducationLevel: EducationLevel | null;
  managementRelevant: boolean;
  skills: OccupationRequirementLink[];
  certifications: OccupationRequirementLink[];
}

export interface TransitionRule {
  id: number;
  sourceOccupationId: number;
  targetOccupationId: number;
  baseTransitionScore: number;
  requiredSkillIds: number[];
  preferredSkillIds: number[];
  requiredCertificationIds: number[];
  preferredCertificationIds: number[];
  minimumExperienceYears: number;
}

export interface SalaryBenchmark {
  id: number;
  occupationId: number;
  regionId: number | null;
  experienceBand: ExperienceBand;
  educationLevel: EducationLevel | null;
  salaryLow: number;
  salaryMedian: number;
  salaryHigh: number;
  confidenceLevel: ConfidenceLevel;
  sourceDate: string;
}

export interface ScoreBreakdown {
  skill: number;
  certification: number;
  experience: number;
  location: number;
  workingCondition: number;
  profile: number;
  weightedSubtotal: number;
  transitionFactor: number;
  requirementPenalty: number;
  final: number;
  [key: string]: number;
}

export interface OccupationMatch {
  occupationId: number;
  occupationName: string;
  isCurrent: boolean;
  matchScore: number;
  breakdown: ScoreBreakdown;
  unmetRequirements: { skillIds: number[]; certificationIds: number[] };
  transitionRuleId: number | null;
  benchmark: SalaryBenchmark | null;
  /** Candidate-specific band derived from the benchmark and the match score. */
  expectedSalaryLow: number | null;
  expectedSalaryHigh: number | null;
}

export interface DiagnosisResult {
  engineVersion: string;
  currentOccupationId: number;
  currentSalaryYen: number;
  currentMarket: { low: number; median: number; high: number } | null;
  estimatedSalaryLow: number | null;
  estimatedSalaryHigh: number | null;
  upliftLow: number | null;
  upliftHigh: number | null;
  bestMatchScore: number;
  matchRank: MatchRank;
  dataConfidence: ConfidenceLevel;
  /** All evaluated occupations, current first, then ranked career options. */
  matches: OccupationMatch[];
  /** Options actually shown to the candidate (already filtered and capped). */
  careerOptions: OccupationMatch[];
  valuedExperiences: string[];
}
