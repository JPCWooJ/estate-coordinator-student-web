"use client";

import { FormEvent, useState } from "react";

import type {
  BeneficiaryEntry,
  CanonicalIntakeState,
  IntakeSection,
  TeamContact,
  StructuredIntakeSubmission,
} from "@/lib/domain/intake";
import { OUTCOME_LABELS, type OutcomeCode } from "@/lib/domain/matter-opening";

type EditableSection = Exclude<IntakeSection, "planning_summary">;

const OUTCOMES = Object.entries(OUTCOME_LABELS) as Array<
  [keyof typeof OUTCOME_LABELS, string]
>;

const RANGE_OPTIONS = [
  "under $1 million",
  "$1 million to $3 million",
  "$3 million to $5 million",
  "$5 million to $10 million",
  "$10 million to $25 million",
  "$25 million or more",
  "none",
  "unknown",
  "not decided",
];

function values(form: HTMLFormElement) {
  return new FormData(form);
}

function text(data: FormData, key: string, fallback = "") {
  return String(data.get(key) ?? fallback).trim();
}

function checked(data: FormData, key: string) {
  return data.getAll(key).map(String);
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="intake-field">
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
      {children}
    </label>
  );
}

function RangeSelect({ name, label, initial }: { name: string; label: string; initial?: string }) {
  return (
    <Field label={label} hint="A planning range is enough.">
      <select name={name} defaultValue={initial || ""} required>
        <option value="" disabled>Select a range</option>
        {RANGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    </Field>
  );
}

export function StructuredIntakeForm({
  section,
  canonical,
  busy,
  onSave,
  onCancel,
}: {
  section: EditableSection;
  canonical: CanonicalIntakeState;
  busy: boolean;
  onSave: (submission: StructuredIntakeSubmission) => Promise<void>;
  onCancel?: () => void;
}) {
  const [localError, setLocalError] = useState("");
  const goals = canonical.goalsFamily;
  const context = canonical.planningContext;
  const team = canonical.teamContinuity;
  const financial = canonical.financialRange;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = values(event.currentTarget);
    let submission: StructuredIntakeSubmission;
    if (section === "goals_family") {
      const topPriorities = [text(data, "priority1"), text(data, "priority2"), text(data, "priority3")]
        .filter(Boolean) as OutcomeCode[];
      const uniquePriorities = [...new Set(topPriorities)] as typeof topPriorities;
      if (uniquePriorities.length !== topPriorities.length) {
        setLocalError("Choose a different outcome for each ranked priority.");
        return;
      }
      const protection = text(data, "primaryProtection", "not applicable");
      const beneficiaries: BeneficiaryEntry[] = [{
        nameOrGroup: text(data, "primaryName"),
        relationship: text(data, "primaryRelationship"),
        role: "primary" as const,
        treatment: text(data, "primaryTreatment"),
        protectionNeeds: protection === "not applicable" ? [] : [protection],
        readinessNotes: text(data, "primaryReadiness", "not decided"),
      }];
      const substituteName = text(data, "substituteName");
      if (substituteName) {
        beneficiaries.push({
          nameOrGroup: substituteName,
          relationship: text(data, "substituteRelationship", "substitute beneficiary"),
          role: "substitute",
          treatment: text(data, "substituteTreatment", "not decided"),
          protectionNeeds: [],
          readinessNotes: "not decided",
        });
      }
      submission = {
        operationId: crypto.randomUUID(),
        section,
        values: {
          desiredOutcomes: uniquePriorities,
          topPriorities: uniquePriorities,
          successDefinition: text(data, "successDefinition"),
          beneficiaries,
          materialCircumstances: text(data, "materialCircumstances"),
        },
      };
    } else if (section === "planning_context") {
      submission = {
        operationId: crypto.randomUUID(),
        section,
        values: {
          currentPlanStatus: text(data, "currentPlanStatus") as NonNullable<typeof context>["currentPlanStatus"],
          documentTypes: checked(data, "documentTypes"),
          approximatePlanDate: text(data, "approximatePlanDate", "unknown"),
          materialChanges: [text(data, "materialChanges", "none")],
          planningReason: text(data, "planningReason"),
          deadline: text(data, "deadline", "none"),
          primaryResidence: text(data, "primaryResidence"),
          otherJurisdictions: checked(data, "otherJurisdictions").concat(
            text(data, "otherJurisdictionDetail") ? [text(data, "otherJurisdictionDetail")] : [],
          ),
          complexityFlags: checked(data, "complexityFlags"),
          complexityDetails: text(data, "complexityDetails", "none"),
        },
      };
    } else if (section === "team_continuity") {
      const contacts: TeamContact[] = [{
        name: text(data, "contactName"),
        firmOrRelationship: text(data, "contactFirm"),
        role: text(data, "contactRole"),
        email: text(data, "contactEmail"),
        phone: text(data, "contactPhone"),
        primaryOrBackup: "adviser" as const,
        responsibilities: text(data, "contactResponsibilities"),
      }];
      const backupName = text(data, "backupName");
      if (backupName) {
        contacts.push({
          name: backupName,
          firmOrRelationship: text(data, "backupRelationship"),
          role: text(data, "backupRole", "backup decision-maker"),
          email: text(data, "backupEmail"),
          phone: text(data, "backupPhone"),
          primaryOrBackup: "backup",
          responsibilities: text(data, "backupResponsibilities"),
        });
      }
      const continuityResponsibilities = checked(data, "continuityResponsibilities");
      if (!continuityResponsibilities.length) {
        setLocalError("Select at least one responsibility that must continue.");
        return;
      }
      submission = {
        operationId: crypto.randomUUID(),
        section,
        values: {
          contacts,
          missingProfessionalRoles: checked(data, "missingProfessionalRoles"),
          continuityResponsibilities,
          specialAssetsOrPurposes: checked(data, "specialAssetsOrPurposes"),
          readinessPlan: text(data, "readinessPlan"),
        },
      };
    } else {
      submission = {
        operationId: crypto.randomUUID(),
        section,
        values: {
          materialAssetsRange: text(data, "materialAssetsRange"),
          liabilitiesRange: text(data, "liabilitiesRange"),
          expectedInheritanceRange: text(data, "expectedInheritanceRange"),
          lifetimeSecurityFloor: text(data, "lifetimeSecurityFloor"),
          assetsCountedTowardFloor: text(data, "assetsCountedTowardFloor"),
          retainedControlRequirement: text(data, "retainedControlRequirement"),
          extraordinaryFutureObligations: text(data, "extraordinaryFutureObligations"),
        },
      };
    }
    setLocalError("");
    await onSave(submission);
  }

  return (
    <form className="structured-intake" onSubmit={submit} key={section}>
      {section === "goals_family" ? (
        <>
          <div className="eyebrow">1 of 7 · Planning intake</div>
          <h2>Goals, family, and beneficiary intent</h2>
          <p>Rank the outcomes that matter most, then identify who the plan should benefit or protect.</p>
          <div className="intake-grid three-column">
            {[1, 2, 3].map((rank) => (
              <Field key={rank} label={`${rank}. Priority`}>
                <select name={`priority${rank}`} defaultValue={goals?.topPriorities[rank - 1] ?? ""} required>
                  <option value="" disabled>Select an outcome</option>
                  {OUTCOMES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </Field>
            ))}
          </div>
          <Field label="What would a successful plan accomplish?" hint="Use your own words; this is a planning judgment.">
            <textarea name="successDefinition" rows={3} defaultValue={goals?.successDefinition} required />
          </Field>
          <fieldset className="intake-group">
            <legend>Primary beneficiary or protected person</legend>
            <div className="intake-grid">
              <Field label="Name or group"><input name="primaryName" defaultValue={goals?.beneficiaries[0]?.nameOrGroup} required /></Field>
              <Field label="Relationship"><input name="primaryRelationship" defaultValue={goals?.beneficiaries[0]?.relationship} required /></Field>
              <Field label="Intended treatment"><select name="primaryTreatment" defaultValue={goals?.beneficiaries[0]?.treatment || "lifetime security first"}><option>lifetime security first</option><option>equal treatment</option><option>different treatment based on need</option><option>not decided</option></select></Field>
              <Field label="Protection need"><select name="primaryProtection" defaultValue={goals?.beneficiaries[0]?.protectionNeeds[0] || "not applicable"}><option>not applicable</option><option>creditor protection</option><option>marital-claim protection</option><option>financial immaturity</option><option>outside influence</option></select></Field>
              <Field label="Readiness"><select name="primaryReadiness" defaultValue={goals?.beneficiaries[0]?.readinessNotes || "not decided"}><option>ready now</option><option>increasing participation with readiness</option><option>continuing oversight needed</option><option>not decided</option></select></Field>
            </div>
          </fieldset>
          <fieldset className="intake-group">
            <legend>Substitute beneficiary, if known</legend>
            <div className="intake-grid">
              <Field label="Name or group"><input name="substituteName" defaultValue={goals?.beneficiaries.find((item) => item.role === "substitute")?.nameOrGroup} /></Field>
              <Field label="Relationship"><input name="substituteRelationship" defaultValue={goals?.beneficiaries.find((item) => item.role === "substitute")?.relationship} /></Field>
              <Field label="Treatment"><select name="substituteTreatment" defaultValue={goals?.beneficiaries.find((item) => item.role === "substitute")?.treatment || "not decided"}><option>equal treatment</option><option>by family branch</option><option>different treatment</option><option>not decided</option></select></Field>
            </div>
          </fieldset>
          <Field label="Material family circumstances"><select name="materialCircumstances" defaultValue={goals?.materialCircumstances || "none identified"} required><option>none identified</option><option>potential family conflict</option><option>beneficiary with continuing support needs</option><option>unusual treatment requires explanation</option><option>not decided</option></select></Field>
        </>
      ) : section === "planning_context" ? (
        <>
          <div className="eyebrow">2 of 7 · Planning intake</div>
          <h2>Current plan and planning context</h2>
          <p>Group the plan facts, timing, locations, and material complexity in one place.</p>
          <div className="intake-grid">
            <Field label="Current plan status"><select name="currentPlanStatus" defaultValue={context?.currentPlanStatus || "unknown"} required><option value="no_existing_plan">No existing plan</option><option value="unsure_what_exists">Not sure what exists</option><option value="review_requested">Review requested</option><option value="implementation_or_organization_needed">Implementation or organization needed</option><option value="current">Believed current</option><option value="update_needed">Update needed</option><option value="unknown">Unknown</option></select></Field>
            <Field label="Approximate plan date"><input name="approximatePlanDate" defaultValue={context?.approximatePlanDate} placeholder="Year, range, or unknown" required /></Field>
            <Field label="Why are you planning now?"><input name="planningReason" defaultValue={context?.planningReason} required /></Field>
            <Field label="Deadline or event"><input name="deadline" defaultValue={context?.deadline || "none"} required /></Field>
            <Field label="Primary residence"><input name="primaryResidence" defaultValue={context?.primaryResidence} required /></Field>
            <Field label="Material changes"><input name="materialChanges" defaultValue={context?.materialChanges.join("; ") || "none"} required /></Field>
          </div>
          <fieldset className="check-grid"><legend>Known documents or arrangements</legend>{["will", "revocable trust", "powers of attorney", "health-care documents", "beneficiary designations", "none known"].map((item) => <label key={item}><input type="checkbox" name="documentTypes" value={item} defaultChecked={context?.documentTypes.includes(item)} /> {item}</label>)}</fieldset>
          <fieldset className="check-grid"><legend>Other jurisdictions</legend>{["real estate in another state", "business in another state", "foreign connection", "none"].map((item) => <label key={item}><input type="checkbox" name="otherJurisdictions" value={item} defaultChecked={context?.otherJurisdictions.includes(item)} /> {item}</label>)}<input name="otherJurisdictionDetail" placeholder="Location or short detail, if applicable" /></fieldset>
          <fieldset className="check-grid"><legend>Material complexity</legend>{["trust", "business", "digital assets", "charitable planning", "retirement assets", "insurance", "none identified"].map((item) => <label key={item}><input type="checkbox" name="complexityFlags" value={item} defaultChecked={context?.complexityFlags.includes(item)} /> {item}</label>)}</fieldset>
          <Field label="Complexity detail" hint="Explain only a selected complexity; otherwise enter none."><input name="complexityDetails" defaultValue={context?.complexityDetails || "none"} required /></Field>
        </>
      ) : section === "team_continuity" ? (
        <>
          <div className="eyebrow">3 of 7 · Planning intake</div>
          <h2>Team and continuity</h2>
          <p>Provide contact details for the key people involved in your estate planning.</p>
          <fieldset className="intake-group"><legend>Primary adviser or participant</legend><div className="intake-grid"><Field label="Name"><input name="contactName" defaultValue={team?.contacts[0]?.name} required /></Field><Field label="Firm or relationship"><input name="contactFirm" defaultValue={team?.contacts[0]?.firmOrRelationship} /></Field><Field label="Role"><input name="contactRole" defaultValue={team?.contacts[0]?.role} required /></Field><Field label="Email"><input type="email" name="contactEmail" defaultValue={team?.contacts[0]?.email} /></Field><Field label="Phone"><input name="contactPhone" defaultValue={team?.contacts[0]?.phone} /></Field><Field label="Responsibilities"><input name="contactResponsibilities" defaultValue={team?.contacts[0]?.responsibilities} /></Field></div></fieldset>
          <fieldset className="intake-group"><legend>Backup, if known</legend><div className="intake-grid"><Field label="Name"><input name="backupName" defaultValue={team?.contacts.find((item) => item.primaryOrBackup === "backup")?.name} /></Field><Field label="Relationship"><input name="backupRelationship" defaultValue={team?.contacts.find((item) => item.primaryOrBackup === "backup")?.firmOrRelationship} /></Field><Field label="Role"><input name="backupRole" defaultValue={team?.contacts.find((item) => item.primaryOrBackup === "backup")?.role} /></Field><Field label="Email"><input type="email" name="backupEmail" defaultValue={team?.contacts.find((item) => item.primaryOrBackup === "backup")?.email} /></Field><Field label="Phone"><input name="backupPhone" defaultValue={team?.contacts.find((item) => item.primaryOrBackup === "backup")?.phone} /></Field><Field label="Responsibilities"><input name="backupResponsibilities" defaultValue={team?.contacts.find((item) => item.primaryOrBackup === "backup")?.responsibilities} /></Field></div></fieldset>
          <fieldset className="check-grid"><legend>Professional roles still needed</legend>{["estate-planning attorney", "CPA or tax adviser", "financial adviser", "insurance adviser", "professional fiduciary", "none"].map((item) => <label key={item}><input type="checkbox" name="missingProfessionalRoles" value={item} defaultChecked={team?.missingProfessionalRoles.includes(item)} /> {item}</label>)}</fieldset>
          <fieldset className="check-grid"><legend>Responsibilities that must continue</legend>{["household support", "bill payment", "investment oversight", "business management", "property management", "digital access"].map((item) => <label key={item}><input type="checkbox" name="continuityResponsibilities" value={item} defaultChecked={team ? team.continuityResponsibilities.includes(item) : item === "household support"} /> {item}</label>)}</fieldset>
          <fieldset className="check-grid"><legend>Special assets or purposes</legend>{["business", "real estate", "digital assets", "charitable purpose", "none"].map((item) => <label key={item}><input type="checkbox" name="specialAssetsOrPurposes" value={item} defaultChecked={team?.specialAssetsOrPurposes.includes(item)} /> {item}</label>)}</fieldset>
          <Field label="Family readiness plan"><select name="readinessPlan" defaultValue={team?.readinessPlan || "not decided"} required><option>annual family meeting</option><option>increasing participation with readiness</option><option>professional oversight continues</option><option>not decided</option></select></Field>
        </>
      ) : (
        <>
          <div className="eyebrow">4 of 7 · Planning intake</div>
          <h2>Financial planning range</h2>
          <p>Use broad ranges. Account-level detail is not needed.</p>
          <div className="intake-grid">
            <RangeSelect name="materialAssetsRange" label="Material assets" initial={financial?.materialAssetsRange} />
            <RangeSelect name="liabilitiesRange" label="Liabilities" initial={financial?.liabilitiesRange} />
            <RangeSelect name="expectedInheritanceRange" label="Expected inheritance" initial={financial?.expectedInheritanceRange} />
            <RangeSelect name="lifetimeSecurityFloor" label="Lifetime-security floor" initial={financial?.lifetimeSecurityFloor} />
            <Field label="Assets counted toward that floor"><select name="assetsCountedTowardFloor" defaultValue={financial?.assetsCountedTowardFloor || "liquid investments and primary residence"} required><option>liquid investments only</option><option>liquid investments and primary residence</option><option>all material assets</option><option>not decided</option><option>unknown</option></select></Field>
            <Field label="Retained-control requirement"><select name="retainedControlRequirement" defaultValue={financial?.retainedControlRequirement || "retain the home and liquid investments"} required><option>retain the home and liquid investments</option><option>retain all current control</option><option>flexibility matters more than control</option><option>not decided</option><option>unknown</option></select></Field>
            <Field label="Extraordinary future obligations"><select name="extraordinaryFutureObligations" defaultValue={financial?.extraordinaryFutureObligations || "none"} required><option>none</option><option>education support</option><option>continuing family support</option><option>business capital need</option><option>not decided</option><option>unknown</option></select></Field>
          </div>
        </>
      )}
      <p className="error-text" role="alert">{localError}</p>
      <div className="form-actions">
        {onCancel ? <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel edit</button> : null}
        <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
      </div>
    </form>
  );
}
