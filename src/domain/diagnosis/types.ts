export type ExperienceBand = '0-2' | '3-5' | '6-9' | '10-14' | '15+';

export type EducationLevel =
  | 'high_school'
  | 'vocational'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'other';

export type EmploymentType =
  | 'full_time'
  | 'contract'
  | 'dispatch'
  | 'part_time'
  | 'freelance'
  | 'unemployed';

export type ValueRank = 'S' | 'A' | 'B' | 'C';

/** Answers collected by the 15-question anonymous diagnosis. */
export interface DiagnosisInput {
  currentSalary: number;
  currentOccupationId: string;
  currentIndustry: string;
  experienceYears: number;
  skillIds: string[];
  certificationIds: string[];
  hasManagementExperience: boolean;
  employmentType: EmploymentType;
  currentPrefecture: string;
  desiredPrefectures: string[];
  relocationOk: boolean;
  businessTripOk: boolean;
  nightShiftOk: boolean;
  educationLevel: EducationLevel;
  desiredConditions: string[];
  ageBand: string;
  jobChangeTiming: string;
}

export interface OccupationRef {
  id: string;
  name: string;
  category: string;
  description?: string | null;
}

export interface SkillRef {
  id: string;
  name: string;
  category: string;
}

export interface CertificationRef {
  id: string;
  name: string;
  category: string;
}

export interface RegionRef {
  id: string;
  name: string;
  prefecture: string;
  isNationalFallback: boolean;
}

export interface OccupationSkillLink {
  occupationId: string;
  skillId: string;
  importanceWeight: number;
}

export interface OccupationCertificationLink {
  occupationId: string;
  certificationId: string;
  importanceWeight: number;
}

export interface TransitionRule {
  id: string;
  sourceOccupationId: string;
  targetOccupationId: string;
  baseTransitionScore: number;
  requiredSkillIds: string[];
  preferredSkillIds: string[];
  requiredCertificationIds: string[];
  preferredCertificationIds: string[];
  minimumExperienceYears: number;
  requiresRelocation: boolean;
  requiresBusinessTrip: boolean;
  requiresNightShift: boolean;
  notes?: string | null;
}

export interface SalaryBenchmark {
  occupationId: string;
  regionId: string;
  experienceBand: ExperienceBand;
  educationLevel: EducationLevel | null;
  salaryLow: number;
  salaryMedian: number;
  salaryHigh: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  source: string;
}

/** Everything the engine needs. Passed in explicitly so the engine stays pure. */
export interface DiagnosisMasters {
  occupations: OccupationRef[];
  skills: SkillRef[];
  certifications: CertificationRef[];
  regions: RegionRef[];
  occupationSkills: OccupationSkillLink[];
  occupationCertifications: OccupationCertificationLink[];
  transitionRules: TransitionRule[];
  benchmarks: SalaryBenchmark[];
}

export interface MatchBreakdown {
  skill: number;
  certification: number;
  experience: number;
  location: number;
  workingCondition: number;
  educationManagement: number;
  transitionAffinity: number;
  /** weighted component subtotal before the affinity blend */
  componentScore: number;
}

export interface OccupationOption {
  occupationId: string;
  occupationName: string;
  occupationCategory: string;
  isCurrentOccupation: boolean;
  matchScore: number;
  breakdown: MatchBreakdown;
  benchmark: SalaryBenchmark | null;
  /** point estimate for this candidate in this occupation (JPY, unrounded) */
  expectedSalary: number | null;
  /** expectedSalary - currentSalary */
  expectedUpside: number | null;
  matchedSkillIds: string[];
  missingRequiredSkillIds: string[];
  matchedCertificationIds: string[];
  notes?: string | null;
}

export interface DiagnosisResult {
  engineVersion: string;
  currentSalary: number;
  currentOccupationId: string;
  currentOccupationName: string;
  regionId: string | null;
  experienceBand: ExperienceBand;
  /** market median for the candidate's current occupation & region */
  currentMarketMedian: number | null;
  /** rounded, display-ready range for a job change */
  estimatedSalaryLow: number;
  estimatedSalaryHigh: number;
  improvementLow: number;
  improvementHigh: number;
  valueRank: ValueRank;
  marketValueScore: number;
  bestMatchScore: number;
  qualified: boolean;
  /** all options above the threshold, best first */
  options: OccupationOption[];
  /** options other than the current occupation */
  adjacentOptions: OccupationOption[];
  /** options ordered by expected upside */
  upsideOptions: OccupationOption[];
  valuedSkills: SkillRef[];
  valuedCertifications: CertificationRef[];
  /** true when no benchmark data backed the estimate */
  dataConfidence: 'low' | 'medium' | 'high';
  warnings: string[];
}
