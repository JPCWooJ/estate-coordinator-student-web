import { z } from "zod";

export const DEFAULT_FEDERAL_EFFECTIVE_TAX_RATE_PERCENT = 25;
export const DEFAULT_SAFETY_BUFFER_PERCENT = 30;
export const PLANNING_WITHDRAWAL_RATE = 0.04;

export const FinancialAssetCategorySchema = z.enum([
  "retirement_accounts",
  "brokerage_accounts",
  "cash_money_market",
  "primary_residence",
  "investment_real_estate",
  "venture_capital_startups",
  "private_equity",
  "private_credit",
  "business_interests",
  "digital_assets",
  "life_insurance_ilit",
  "other_trusts",
  "other_assets",
]);
export type FinancialAssetCategory = z.infer<
  typeof FinancialAssetCategorySchema
>;

export const FinancialLiabilityCategorySchema = z.enum([
  "mortgages",
  "personal_loans",
  "business_liabilities",
  "other_liabilities",
]);
export type FinancialLiabilityCategory = z.infer<
  typeof FinancialLiabilityCategorySchema
>;

export const OwnershipControlStatusSchema = z.enum([
  "direct_control",
  "shared_control",
  "controlled_entity_or_trust",
  "no_direct_control",
  "unknown",
]);
export type OwnershipControlStatus = z.infer<
  typeof OwnershipControlStatusSchema
>;

const ApproximateValueSchema = z
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000_000_000_000);

const FinancialEntryBaseSchema = z.object({
  id: z.string().uuid(),
  approximateValue: ApproximateValueSchema,
  description: z.string().trim().max(160),
  ownershipControl: OwnershipControlStatusSchema,
  note: z.string().trim().max(500),
});

export const FinancialAssetEntrySchema = FinancialEntryBaseSchema.extend({
  category: FinancialAssetCategorySchema,
});
export type FinancialAssetEntry = z.infer<typeof FinancialAssetEntrySchema>;

export const FinancialLiabilityEntrySchema = FinancialEntryBaseSchema.extend({
  category: FinancialLiabilityCategorySchema,
});
export type FinancialLiabilityEntry = z.infer<
  typeof FinancialLiabilityEntrySchema
>;

export const RecurringIncomeSourceSchema = z.object({
  id: z.string().uuid(),
  source: z.string().trim().min(1).max(160),
  monthlyAmount: ApproximateValueSchema,
  linkedAssetId: z.string().uuid().nullable(),
});
export type RecurringIncomeSource = z.infer<
  typeof RecurringIncomeSourceSchema
>;

export const LifestyleSecurityInputsSchema = z.object({
  monthlyExpenses: ApproximateValueSchema,
  incomeSources: z.array(RecurringIncomeSourceSchema).max(50),
  safetyBufferPercent: z.number().finite().min(0).max(200),
  federalEffectiveTaxRatePercent: z.number().finite().min(0).max(99),
});
export type LifestyleSecurityInputs = z.infer<
  typeof LifestyleSecurityInputsSchema
>;

export const FinancialPlanningStatusSchema = z.enum([
  "provided",
  "none",
  "unknown",
  "not_decided",
]);
export type FinancialPlanningStatus = z.infer<
  typeof FinancialPlanningStatusSchema
>;

export const ExpectedInheritanceRangeSchema = z.enum([
  "none",
  "under_1m",
  "1m_to_5m",
  "5m_to_10m",
  "10m_to_25m",
  "25m_to_50m",
  "over_50m",
  "unknown",
  "not_decided",
]);

export const FinancialPlanningInputsSchema = z
  .object({
    materialAssetsStatus: FinancialPlanningStatusSchema,
    liabilitiesStatus: FinancialPlanningStatusSchema,
    expectedInheritanceRange: ExpectedInheritanceRangeSchema,
    lifetimeSecurityFloor: z.object({
      selection: z.enum(["calculated", "custom", "unknown", "not_decided"]),
      customAmount: ApproximateValueSchema.nullable(),
    }),
    assetsCountedTowardFloor: z.enum([
      "linked_income_producing_assets",
      "none",
      "unknown",
      "not_decided",
    ]),
    retainedControlRequirement: z.object({
      selection: z.enum(["provided", "none", "unknown", "not_decided"]),
      detail: z.string().trim().max(500),
    }),
    extraordinaryFutureObligations: z.object({
      selection: z.enum(["provided", "none", "unknown", "not_decided"]),
      detail: z.string().trim().max(500),
      approximateValue: ApproximateValueSchema.nullable(),
    }),
  })
  .superRefine((planning, context) => {
    if (
      planning.lifetimeSecurityFloor.selection === "custom" &&
      planning.lifetimeSecurityFloor.customAmount === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["lifetimeSecurityFloor", "customAmount"],
        message: "Enter the custom lifetime-security floor.",
      });
    }
    if (
      planning.retainedControlRequirement.selection === "provided" &&
      !planning.retainedControlRequirement.detail
    ) {
      context.addIssue({
        code: "custom",
        path: ["retainedControlRequirement", "detail"],
        message: "Describe the assets or control that planning should retain.",
      });
    }
    if (
      planning.extraordinaryFutureObligations.selection === "provided" &&
      !planning.extraordinaryFutureObligations.detail
    ) {
      context.addIssue({
        code: "custom",
        path: ["extraordinaryFutureObligations", "detail"],
        message: "Describe the extraordinary future obligation.",
      });
    }
  });
export type FinancialPlanningInputs = z.infer<
  typeof FinancialPlanningInputsSchema
>;

export const DEFAULT_FINANCIAL_PLANNING_INPUTS: FinancialPlanningInputs = {
  materialAssetsStatus: "provided",
  liabilitiesStatus: "provided",
  expectedInheritanceRange: "not_decided",
  lifetimeSecurityFloor: {
    selection: "calculated",
    customAmount: null,
  },
  assetsCountedTowardFloor: "linked_income_producing_assets",
  retainedControlRequirement: {
    selection: "not_decided",
    detail: "",
  },
  extraordinaryFutureObligations: {
    selection: "not_decided",
    detail: "",
    approximateValue: null,
  },
};

export const FinancialProfileInputsSchema = z
  .object({
    assets: z.array(FinancialAssetEntrySchema).max(100),
    liabilities: z.array(FinancialLiabilityEntrySchema).max(100),
    lifestyle: LifestyleSecurityInputsSchema,
    planning: FinancialPlanningInputsSchema.default(
      DEFAULT_FINANCIAL_PLANNING_INPUTS,
    ),
  })
  .superRefine((input, context) => {
    const assetIds = new Set(input.assets.map((asset) => asset.id));
    input.lifestyle.incomeSources.forEach((source, index) => {
      if (source.linkedAssetId && !assetIds.has(source.linkedAssetId)) {
        context.addIssue({
          code: "custom",
          path: ["lifestyle", "incomeSources", index, "linkedAssetId"],
          message: "Linked income-producing asset was not found in the balance sheet.",
        });
      }
    });
  });
export type FinancialProfileInputs = z.infer<
  typeof FinancialProfileInputsSchema
>;
export type FinancialProfileInput = z.input<
  typeof FinancialProfileInputsSchema
>;

export const FinancialCalculationsSchema = z.object({
  totalAssets: ApproximateValueSchema,
  totalLiabilities: ApproximateValueSchema,
  estimatedNetEstate: z.number().finite(),
  monthlyRecurringIncome: ApproximateValueSchema,
  annualShortfall: ApproximateValueSchema,
  annualSurplus: ApproximateValueSchema,
  taxAdjustedAnnualPortfolioIncomeRequired: ApproximateValueSchema,
  minimumLiquidAssetsRequired: ApproximateValueSchema,
  retainedIncomeProducingAssets: ApproximateValueSchema,
  recommendedControllableEstateFloor: ApproximateValueSchema,
});
export type FinancialCalculations = z.infer<
  typeof FinancialCalculationsSchema
>;

export const FinancialProfileSchema = FinancialProfileInputsSchema.and(
  z.object({
    calculationVersion: z.literal("lifestyle-security-v1"),
    calculations: FinancialCalculationsSchema,
  }),
);
export type FinancialProfile = z.infer<typeof FinancialProfileSchema>;

const RETAINED_CONTROL_STATUSES = new Set<OwnershipControlStatus>([
  "direct_control",
  "shared_control",
  "controlled_entity_or_trust",
]);

export function retainedIncomeProducingAssets(
  input: Pick<FinancialProfileInputs, "assets" | "lifestyle">,
) {
  const incomeLinkedAssetIds = new Set(
    input.lifestyle.incomeSources.flatMap((source) =>
      source.linkedAssetId ? [source.linkedAssetId] : [],
    ),
  );
  return input.assets.filter(
    (asset) =>
      incomeLinkedAssetIds.has(asset.id) &&
      RETAINED_CONTROL_STATUSES.has(asset.ownershipControl),
  );
}

function dollars(value: number) {
  return Math.round(value);
}

export function calculateFinancialProfile(
  input: FinancialProfileInput,
): FinancialCalculations {
  const parsed = FinancialProfileInputsSchema.parse(input);
  const totalAssets = parsed.assets.reduce(
    (sum, asset) => sum + asset.approximateValue,
    0,
  );
  const totalLiabilities = parsed.liabilities.reduce(
    (sum, liability) => sum + liability.approximateValue,
    0,
  );
  const monthlyRecurringIncome = parsed.lifestyle.incomeSources.reduce(
    (sum, source) => sum + source.monthlyAmount,
    0,
  );
  const monthlyGap = parsed.lifestyle.monthlyExpenses - monthlyRecurringIncome;
  const annualShortfall = Math.max(monthlyGap, 0) * 12;
  const annualSurplus = Math.max(-monthlyGap, 0) * 12;
  const taxRate = parsed.lifestyle.federalEffectiveTaxRatePercent / 100;
  const taxAdjustedAnnualPortfolioIncomeRequired =
    annualShortfall === 0 ? 0 : annualShortfall / (1 - taxRate);
  const minimumLiquidAssetsRequired =
    taxAdjustedAnnualPortfolioIncomeRequired / PLANNING_WITHDRAWAL_RATE;

  const retainedIncomeProducingAssetTotal = retainedIncomeProducingAssets(
    parsed,
  ).reduce(
    (sum, asset) => sum + asset.approximateValue,
    0,
  );
  const recommendedControllableEstateFloor =
    minimumLiquidAssetsRequired *
      (1 + parsed.lifestyle.safetyBufferPercent / 100) +
    retainedIncomeProducingAssetTotal;

  return FinancialCalculationsSchema.parse({
    totalAssets: dollars(totalAssets),
    totalLiabilities: dollars(totalLiabilities),
    estimatedNetEstate: dollars(totalAssets - totalLiabilities),
    monthlyRecurringIncome: dollars(monthlyRecurringIncome),
    annualShortfall: dollars(annualShortfall),
    annualSurplus: dollars(annualSurplus),
    taxAdjustedAnnualPortfolioIncomeRequired: dollars(
      taxAdjustedAnnualPortfolioIncomeRequired,
    ),
    minimumLiquidAssetsRequired: dollars(minimumLiquidAssetsRequired),
    retainedIncomeProducingAssets: dollars(retainedIncomeProducingAssetTotal),
    recommendedControllableEstateFloor: dollars(
      recommendedControllableEstateFloor,
    ),
  });
}

export function createFinancialProfile(
  input: FinancialProfileInput,
): FinancialProfile {
  const parsed = FinancialProfileInputsSchema.parse(input);
  return FinancialProfileSchema.parse({
    ...parsed,
    calculationVersion: "lifestyle-security-v1",
    calculations: calculateFinancialProfile(parsed),
  });
}
