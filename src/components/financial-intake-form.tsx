"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  calculateFinancialProfile,
  DEFAULT_FEDERAL_EFFECTIVE_TAX_RATE_PERCENT,
  DEFAULT_SAFETY_BUFFER_PERCENT,
  FinancialProfileInputsSchema,
  type FinancialAssetCategory,
  type FinancialAssetEntry,
  type FinancialLiabilityCategory,
  type FinancialLiabilityEntry,
  type FinancialProfile,
  type OwnershipControlStatus,
  type RecurringIncomeSource,
} from "@/lib/domain/financial-intake";
import type {
  CanonicalIntakeState,
  StructuredIntakeSubmission,
} from "@/lib/domain/intake";

const ASSET_CATEGORIES: Array<[FinancialAssetCategory, string]> = [
  ["retirement_accounts", "Retirement accounts"],
  ["brokerage_accounts", "Brokerage accounts"],
  ["cash_money_market", "Cash / money market"],
  ["primary_residence", "Primary residence"],
  ["investment_real_estate", "Investment real estate"],
  ["venture_capital_startups", "Venture capital / startups"],
  ["private_equity", "Private equity"],
  ["private_credit", "Private credit"],
  ["business_interests", "Business interests"],
  ["digital_assets", "Digital assets"],
  ["life_insurance_ilit", "Life insurance / ILIT"],
  ["other_trusts", "Other trusts"],
  ["other_assets", "Other assets"],
];

const LIABILITY_CATEGORIES: Array<[FinancialLiabilityCategory, string]> = [
  ["mortgages", "Mortgages"],
  ["personal_loans", "Personal loans"],
  ["business_liabilities", "Business liabilities"],
  ["other_liabilities", "Other liabilities"],
];

const CONTROL_STATUSES: Array<[OwnershipControlStatus, string]> = [
  ["direct_control", "Direct control"],
  ["shared_control", "Shared / joint control"],
  ["controlled_entity_or_trust", "Controlled entity or trust"],
  ["no_direct_control", "No direct control"],
  ["unknown", "Not sure"],
];

type EditableAsset = Omit<FinancialAssetEntry, "approximateValue"> & {
  approximateValue: string;
};
type EditableLiability = Omit<FinancialLiabilityEntry, "approximateValue"> & {
  approximateValue: string;
};
type EditableIncome = Omit<RecurringIncomeSource, "monthlyAmount"> & {
  monthlyAmount: string;
};

function currency(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function assetLabel(asset: EditableAsset) {
  const category = ASSET_CATEGORIES.find(([value]) => value === asset.category)?.[1];
  return asset.description.trim() || category || "Asset";
}

function editableAssets(profile: FinancialProfile | null): EditableAsset[] {
  return (profile?.assets ?? []).map((asset) => ({
    ...asset,
    approximateValue: String(asset.approximateValue),
  }));
}

function editableLiabilities(
  profile: FinancialProfile | null,
): EditableLiability[] {
  return (profile?.liabilities ?? []).map((liability) => ({
    ...liability,
    approximateValue: String(liability.approximateValue),
  }));
}

function editableIncome(profile: FinancialProfile | null): EditableIncome[] {
  return (profile?.lifestyle.incomeSources ?? []).map((source) => ({
    ...source,
    monthlyAmount: String(source.monthlyAmount),
  }));
}

function numberValue(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export function FinancialIntakeForm({
  canonical,
  busy,
  onSave,
  onCancel,
}: {
  canonical: CanonicalIntakeState;
  busy: boolean;
  onSave: (submission: StructuredIntakeSubmission) => Promise<void>;
  onCancel?: () => void;
}) {
  const profile = canonical.financialProfile ?? null;
  const [assets, setAssets] = useState<EditableAsset[]>(() =>
    editableAssets(profile),
  );
  const [liabilities, setLiabilities] = useState<EditableLiability[]>(() =>
    editableLiabilities(profile),
  );
  const [incomeSources, setIncomeSources] = useState<EditableIncome[]>(() =>
    editableIncome(profile),
  );
  const [monthlyExpenses, setMonthlyExpenses] = useState(
    profile ? String(profile.lifestyle.monthlyExpenses) : "",
  );
  const [safetyBufferPercent, setSafetyBufferPercent] = useState(
    String(
      profile?.lifestyle.safetyBufferPercent ??
        DEFAULT_SAFETY_BUFFER_PERCENT,
    ),
  );
  const [federalTaxRatePercent, setFederalTaxRatePercent] = useState(
    String(
      profile?.lifestyle.federalEffectiveTaxRatePercent ??
        DEFAULT_FEDERAL_EFFECTIVE_TAX_RATE_PERCENT,
    ),
  );
  const [localError, setLocalError] = useState("");

  const parsedInputs = useMemo(
    () =>
      FinancialProfileInputsSchema.safeParse({
        assets: assets.map((asset) => ({
          ...asset,
          approximateValue: numberValue(asset.approximateValue),
        })),
        liabilities: liabilities.map((liability) => ({
          ...liability,
          approximateValue: numberValue(liability.approximateValue),
        })),
        lifestyle: {
          monthlyExpenses: numberValue(monthlyExpenses),
          incomeSources: incomeSources.map((source) => ({
            ...source,
            monthlyAmount: numberValue(source.monthlyAmount),
          })),
          safetyBufferPercent: numberValue(safetyBufferPercent),
          federalEffectiveTaxRatePercent: numberValue(federalTaxRatePercent),
        },
      }),
    [
      assets,
      federalTaxRatePercent,
      incomeSources,
      liabilities,
      monthlyExpenses,
      safetyBufferPercent,
    ],
  );
  const calculations = parsedInputs.success
    ? calculateFinancialProfile(parsedInputs.data)
    : null;
  const balanceSheetTotals = useMemo(() => {
    const assetValues = assets.map((asset) => numberValue(asset.approximateValue));
    const liabilityValues = liabilities.map((liability) =>
      numberValue(liability.approximateValue),
    );
    if (
      [...assetValues, ...liabilityValues].some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      return null;
    }
    const totalAssets = assetValues.reduce((sum, value) => sum + value, 0);
    const totalLiabilities = liabilityValues.reduce(
      (sum, value) => sum + value,
      0,
    );
    return {
      totalAssets,
      totalLiabilities,
      estimatedNetEstate: totalAssets - totalLiabilities,
    };
  }, [assets, liabilities]);

  function addAsset() {
    setAssets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        category: "retirement_accounts",
        approximateValue: "",
        description: "",
        ownershipControl: "direct_control",
        note: "",
      },
    ]);
  }

  function addLiability() {
    setLiabilities((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        category: "mortgages",
        approximateValue: "",
        description: "",
        ownershipControl: "direct_control",
        note: "",
      },
    ]);
  }

  function addIncomeSource() {
    setIncomeSources((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        source: "",
        monthlyAmount: "",
        linkedAssetId: null,
      },
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsedInputs.success) {
      setLocalError(
        "Complete each added row with a non-negative value. Tax must be below 100%, and the safety buffer cannot exceed 200%.",
      );
      return;
    }
    setLocalError("");
    await onSave({
      operationId: crypto.randomUUID(),
      section: "financial_range",
      values: parsedInputs.data,
    });
  }

  return (
    <form className="structured-intake financial-intake" onSubmit={submit}>
      <section className="financial-module" aria-labelledby="balance-sheet-title">
        <h2 id="balance-sheet-title">Estate Balance Sheet</h2>
        <p>
          Add each material asset and liability once. Approximate values are
          enough for this planning-level estimate.
        </p>

        <div className="financial-subsection">
          <div className="financial-section-heading">
            <div>
              <h3>Assets</h3>
              <p>Use “Add asset” again when you have more than one item in a category.</p>
            </div>
            <button type="button" className="button button-secondary" onClick={addAsset}>
              Add asset
            </button>
          </div>
          {assets.length ? (
            <div className="financial-entry-list">
              {assets.map((asset, index) => (
                <fieldset className="financial-entry" key={asset.id}>
                  <legend>Asset {index + 1}</legend>
                  <div className="financial-entry-grid">
                    <label className="intake-field">
                      <span>Asset category</span>
                      <select
                        value={asset.category}
                        onChange={(event) =>
                          setAssets((current) =>
                            current.map((item) =>
                              item.id === asset.id
                                ? { ...item, category: event.target.value as FinancialAssetCategory }
                                : item,
                            ),
                          )
                        }
                      >
                        {ASSET_CATEGORIES.map(([value, labelText]) => (
                          <option value={value} key={value}>{labelText}</option>
                        ))}
                      </select>
                    </label>
                    <label className="intake-field">
                      <span>Approximate value</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="1"
                        value={asset.approximateValue}
                        onChange={(event) =>
                          setAssets((current) =>
                            current.map((item) =>
                              item.id === asset.id
                                ? { ...item, approximateValue: event.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    <label className="intake-field">
                      <span>Description or name</span>
                      <input
                        value={asset.description}
                        maxLength={160}
                        onChange={(event) =>
                          setAssets((current) =>
                            current.map((item) =>
                              item.id === asset.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="intake-field">
                      <span>Ownership / control</span>
                      <select
                        value={asset.ownershipControl}
                        onChange={(event) =>
                          setAssets((current) =>
                            current.map((item) =>
                              item.id === asset.id
                                ? { ...item, ownershipControl: event.target.value as OwnershipControlStatus }
                                : item,
                            ),
                          )
                        }
                      >
                        {CONTROL_STATUSES.map(([value, labelText]) => (
                          <option value={value} key={value}>{labelText}</option>
                        ))}
                      </select>
                    </label>
                    <label className="intake-field financial-note-field">
                      <span>Note</span>
                      <input
                        value={asset.note}
                        maxLength={500}
                        onChange={(event) =>
                          setAssets((current) =>
                            current.map((item) =>
                              item.id === asset.id ? { ...item, note: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="financial-remove"
                      onClick={() => {
                        setAssets((current) => current.filter((item) => item.id !== asset.id));
                        setIncomeSources((current) =>
                          current.map((source) =>
                            source.linkedAssetId === asset.id
                              ? { ...source, linkedAssetId: null }
                              : source,
                          ),
                        );
                      }}
                    >
                      Remove asset
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
          ) : (
            <p className="financial-empty">No assets added. Add an asset or continue with a zero-asset estimate.</p>
          )}
        </div>

        <div className="financial-subsection">
          <div className="financial-section-heading">
            <div>
              <h3>Liabilities</h3>
              <p>Include extraordinary obligations here when they are existing liabilities.</p>
            </div>
            <button type="button" className="button button-secondary" onClick={addLiability}>
              Add liability
            </button>
          </div>
          {liabilities.length ? (
            <div className="financial-entry-list">
              {liabilities.map((liability, index) => (
                <fieldset className="financial-entry" key={liability.id}>
                  <legend>Liability {index + 1}</legend>
                  <div className="financial-entry-grid">
                    <label className="intake-field">
                      <span>Liability category</span>
                      <select
                        value={liability.category}
                        onChange={(event) =>
                          setLiabilities((current) =>
                            current.map((item) =>
                              item.id === liability.id
                                ? { ...item, category: event.target.value as FinancialLiabilityCategory }
                                : item,
                            ),
                          )
                        }
                      >
                        {LIABILITY_CATEGORIES.map(([value, labelText]) => (
                          <option value={value} key={value}>{labelText}</option>
                        ))}
                      </select>
                    </label>
                    <label className="intake-field">
                      <span>Approximate value</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="1"
                        value={liability.approximateValue}
                        onChange={(event) =>
                          setLiabilities((current) =>
                            current.map((item) =>
                              item.id === liability.id
                                ? { ...item, approximateValue: event.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    <label className="intake-field">
                      <span>Description or name</span>
                      <input
                        value={liability.description}
                        maxLength={160}
                        onChange={(event) =>
                          setLiabilities((current) =>
                            current.map((item) =>
                              item.id === liability.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="intake-field">
                      <span>Ownership / control</span>
                      <select
                        value={liability.ownershipControl}
                        onChange={(event) =>
                          setLiabilities((current) =>
                            current.map((item) =>
                              item.id === liability.id
                                ? { ...item, ownershipControl: event.target.value as OwnershipControlStatus }
                                : item,
                            ),
                          )
                        }
                      >
                        {CONTROL_STATUSES.map(([value, labelText]) => (
                          <option value={value} key={value}>{labelText}</option>
                        ))}
                      </select>
                    </label>
                    <label className="intake-field financial-note-field">
                      <span>Note</span>
                      <input
                        value={liability.note}
                        maxLength={500}
                        onChange={(event) =>
                          setLiabilities((current) =>
                            current.map((item) =>
                              item.id === liability.id ? { ...item, note: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="financial-remove"
                      onClick={() =>
                        setLiabilities((current) =>
                          current.filter((item) => item.id !== liability.id),
                        )
                      }
                    >
                      Remove liability
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
          ) : (
            <p className="financial-empty">No liabilities added.</p>
          )}
        </div>

        <dl className="financial-totals" aria-live="polite">
          <div><dt>Total assets</dt><dd data-testid="total-assets">{currency(balanceSheetTotals?.totalAssets ?? null)}</dd></div>
          <div><dt>Total liabilities</dt><dd data-testid="total-liabilities">{currency(balanceSheetTotals?.totalLiabilities ?? null)}</dd></div>
          <div><dt>Estimated net estate</dt><dd data-testid="net-estate">{currency(balanceSheetTotals?.estimatedNetEstate ?? null)}</dd></div>
        </dl>
      </section>

      <section className="financial-module security-module" aria-labelledby="security-analysis-title">
        <h2 id="security-analysis-title">Lifestyle P&amp;L / Security Analysis</h2>
        <p>
          Enter recurring monthly cash flow. Link an income source to an asset
          only when that asset actually produces the recurring income.
        </p>

        <div className="intake-grid financial-assumptions">
          <label className="intake-field">
            <span>Recurring monthly expenses</span>
            <small>Include recurring support and other ongoing obligations.</small>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={monthlyExpenses}
              onChange={(event) => setMonthlyExpenses(event.target.value)}
              required
            />
          </label>
          <label className="intake-field">
            <span>Federal effective income-tax rate</span>
            <small>Editable federal-only planning assumption; no state tax is included.</small>
            <div className="percent-input">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="99"
                step="0.1"
                value={federalTaxRatePercent}
                onChange={(event) => setFederalTaxRatePercent(event.target.value)}
                required
              />
              <span aria-hidden="true">%</span>
            </div>
          </label>
          <label className="intake-field">
            <span>Safety buffer</span>
            <small>Defaults to 30% and can be changed for this estimate.</small>
            <div className="percent-input">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="200"
                step="0.1"
                value={safetyBufferPercent}
                onChange={(event) => setSafetyBufferPercent(event.target.value)}
                required
              />
              <span aria-hidden="true">%</span>
            </div>
          </label>
        </div>

        <div className="financial-subsection">
          <div className="financial-section-heading">
            <div>
              <h3>Recurring monthly income</h3>
              <p>Identify each source. Link it to a balance-sheet asset only when applicable.</p>
            </div>
            <button type="button" className="button button-secondary" onClick={addIncomeSource}>
              Add income source
            </button>
          </div>
          {incomeSources.length ? (
            <div className="financial-entry-list">
              {incomeSources.map((source, index) => (
                <fieldset className="financial-entry income-entry" key={source.id}>
                  <legend>Income source {index + 1}</legend>
                  <div className="financial-entry-grid income-entry-grid">
                    <label className="intake-field">
                      <span>Income source</span>
                      <input
                        value={source.source}
                        maxLength={160}
                        onChange={(event) =>
                          setIncomeSources((current) =>
                            current.map((item) =>
                              item.id === source.id ? { ...item, source: event.target.value } : item,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    <label className="intake-field">
                      <span>Monthly amount</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="1"
                        value={source.monthlyAmount}
                        onChange={(event) =>
                          setIncomeSources((current) =>
                            current.map((item) =>
                              item.id === source.id
                                ? { ...item, monthlyAmount: event.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    <label className="intake-field">
                      <span>Income-producing asset (optional)</span>
                      <select
                        value={source.linkedAssetId ?? ""}
                        onChange={(event) =>
                          setIncomeSources((current) =>
                            current.map((item) =>
                              item.id === source.id
                                ? { ...item, linkedAssetId: event.target.value || null }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Not linked to an asset</option>
                        {assets.map((asset) => (
                          <option value={asset.id} key={asset.id}>
                            {assetLabel(asset)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="financial-remove"
                      onClick={() =>
                        setIncomeSources((current) =>
                          current.filter((item) => item.id !== source.id),
                        )
                      }
                    >
                      Remove income source
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
          ) : (
            <p className="financial-empty">No recurring income sources added.</p>
          )}
        </div>

        <div className="security-calculation" aria-live="polite">
          <div className="security-calculation-heading">
            <h3>Your planning-level security calculation</h3>
            <p>Values update as you change an input.</p>
          </div>
          <dl>
            <div><dt>Annual shortfall</dt><dd>{currency(calculations?.annualShortfall ?? null)}</dd></div>
            <div><dt>Annual surplus</dt><dd>{currency(calculations?.annualSurplus ?? null)}</dd></div>
            <div><dt>Tax-adjusted annual portfolio income required</dt><dd>{currency(calculations?.taxAdjustedAnnualPortfolioIncomeRequired ?? null)}</dd></div>
            <div><dt>Minimum liquid assets required at 4%</dt><dd>{currency(calculations?.minimumLiquidAssetsRequired ?? null)}</dd></div>
            <div><dt>Retained income-producing assets</dt><dd>{currency(calculations?.retainedIncomeProducingAssets ?? null)}</dd></div>
            <div className="recommended-floor"><dt>Recommended controllable-estate floor</dt><dd data-testid="recommended-estate-floor">{currency(calculations?.recommendedControllableEstateFloor ?? null)}</dd></div>
          </dl>
          <p className="calculation-method">
            Shortfall = max(monthly expenses − monthly recurring income, 0) × 12.
            The shortfall is grossed up using the federal-only effective tax assumption,
            divided by 4%, increased by the selected safety buffer, then added to retained
            assets that you linked to recurring income.
          </p>
        </div>
      </section>

      <p className="error-text" role="alert">{localError}</p>
      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>
            Cancel edit
          </button>
        ) : null}
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </form>
  );
}
