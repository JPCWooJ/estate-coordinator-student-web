import { describe, expect, it } from "vitest";

import {
  calculateFinancialProfile,
  FinancialProfileInputsSchema,
} from "./financial-intake";

const BROKERAGE_ID = "11111111-1111-4111-8111-111111111111";
const RESIDENCE_ID = "22222222-2222-4222-8222-222222222222";

describe("structured financial intake calculations", () => {
  it("preserves the explicit seven-field planning selections alongside the detailed inputs", () => {
    const planning = {
      materialAssetsStatus: "unknown",
      liabilitiesStatus: "none",
      expectedInheritanceRange: "not_decided",
      lifetimeSecurityFloor: {
        selection: "not_decided",
        customAmount: null,
      },
      assetsCountedTowardFloor: "unknown",
      retainedControlRequirement: {
        selection: "not_decided",
        detail: "",
      },
      extraordinaryFutureObligations: {
        selection: "none",
        detail: "",
        approximateValue: null,
      },
    };

    const parsed = FinancialProfileInputsSchema.parse({
      assets: [],
      liabilities: [],
      lifestyle: {
        monthlyExpenses: 8_000,
        incomeSources: [],
        safetyBufferPercent: 30,
        federalEffectiveTaxRatePercent: 25,
      },
      planning,
    });

    expect(parsed).toMatchObject({ planning });
  });

  it("calculates the balance sheet and default-buffer security requirement deterministically", () => {
    const result = calculateFinancialProfile({
      assets: [
        {
          id: BROKERAGE_ID,
          category: "brokerage_accounts",
          approximateValue: 1_000_000,
          description: "Taxable portfolio",
          ownershipControl: "direct_control",
          note: "",
        },
        {
          id: RESIDENCE_ID,
          category: "primary_residence",
          approximateValue: 750_000,
          description: "Home",
          ownershipControl: "shared_control",
          note: "",
        },
      ],
      liabilities: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          category: "mortgages",
          approximateValue: 250_000,
          description: "Home mortgage",
          ownershipControl: "shared_control",
          note: "",
        },
      ],
      lifestyle: {
        monthlyExpenses: 20_000,
        incomeSources: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            source: "Portfolio distributions",
            monthlyAmount: 10_000,
            linkedAssetId: BROKERAGE_ID,
          },
        ],
        safetyBufferPercent: 30,
        federalEffectiveTaxRatePercent: 25,
      },
    });

    expect(result).toEqual({
      totalAssets: 1_750_000,
      totalLiabilities: 250_000,
      estimatedNetEstate: 1_500_000,
      monthlyRecurringIncome: 10_000,
      annualShortfall: 120_000,
      annualSurplus: 0,
      taxAdjustedAnnualPortfolioIncomeRequired: 160_000,
      minimumLiquidAssetsRequired: 4_000_000,
      retainedIncomeProducingAssets: 1_000_000,
      recommendedControllableEstateFloor: 6_200_000,
    });
  });

  it("uses zero shortfall when recurring income meets expenses and reports the surplus", () => {
    const result = calculateFinancialProfile({
      assets: [],
      liabilities: [],
      lifestyle: {
        monthlyExpenses: 8_000,
        incomeSources: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            source: "Pension",
            monthlyAmount: 10_000,
            linkedAssetId: null,
          },
        ],
        safetyBufferPercent: 30,
        federalEffectiveTaxRatePercent: 25,
      },
    });

    expect(result.annualShortfall).toBe(0);
    expect(result.annualSurplus).toBe(24_000);
    expect(result.taxAdjustedAnnualPortfolioIncomeRequired).toBe(0);
    expect(result.minimumLiquidAssetsRequired).toBe(0);
  });

  it("counts an asset once only when recurring income is linked and the user retains control", () => {
    const result = calculateFinancialProfile({
      assets: [
        {
          id: BROKERAGE_ID,
          category: "digital_assets",
          approximateValue: 900_000,
          description: "Income-producing digital asset",
          ownershipControl: "direct_control",
          note: "",
        },
        {
          id: RESIDENCE_ID,
          category: "brokerage_accounts",
          approximateValue: 2_000_000,
          description: "Managed account without retained control",
          ownershipControl: "no_direct_control",
          note: "",
        },
      ],
      liabilities: [],
      lifestyle: {
        monthlyExpenses: 0,
        incomeSources: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            source: "Digital royalties",
            monthlyAmount: 5_000,
            linkedAssetId: BROKERAGE_ID,
          },
          {
            id: "77777777-7777-4777-8777-777777777777",
            source: "Additional digital royalties",
            monthlyAmount: 1_000,
            linkedAssetId: BROKERAGE_ID,
          },
          {
            id: "88888888-8888-4888-8888-888888888888",
            source: "Managed account distributions",
            monthlyAmount: 4_000,
            linkedAssetId: RESIDENCE_ID,
          },
        ],
        safetyBufferPercent: 15,
        federalEffectiveTaxRatePercent: 25,
      },
    });

    expect(result.retainedIncomeProducingAssets).toBe(900_000);
    expect(result.recommendedControllableEstateFloor).toBe(900_000);
  });

  it("immediately reflects user-selected tax and safety-buffer percentages", () => {
    const result = calculateFinancialProfile({
      assets: [],
      liabilities: [],
      lifestyle: {
        monthlyExpenses: 10_000,
        incomeSources: [],
        safetyBufferPercent: 10,
        federalEffectiveTaxRatePercent: 20,
      },
    });

    expect(result.annualShortfall).toBe(120_000);
    expect(result.taxAdjustedAnnualPortfolioIncomeRequired).toBe(150_000);
    expect(result.minimumLiquidAssetsRequired).toBe(3_750_000);
    expect(result.recommendedControllableEstateFloor).toBe(4_125_000);
  });
});
