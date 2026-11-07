/**
 * Demographic options for people. Ethnicity uses the U.S. federal standard
 * (OMB SPD 15, 2024 revision: one combined race/ethnicity question), plus
 * multi-race, other and decline options. Stored as these exact labels;
 * null means not recorded yet.
 */
export const ETHNICITIES = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Pacific Islander",
  "White",
  "Two or more",
  "Other",
  "Prefer not to say",
] as const;

export const INCOME_LEVELS = ["None", "Low", "Medium", "High", "Prefer not to say"] as const;

export type Ethnicity = (typeof ETHNICITIES)[number];
export type IncomeLevel = (typeof INCOME_LEVELS)[number];

export const NOT_RECORDED = "Not recorded";
