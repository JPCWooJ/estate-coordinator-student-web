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
import { FinancialIntakeForm } from "./financial-intake-form";

type EditableSection = Exclude<IntakeSection, "planning_summary">;

const OUTCOMES = Object.entries(OUTCOME_LABELS) as Array<
  [keyof typeof OUTCOME_LABELS, string]
>;

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

type ContactDraft = TeamContact & { rowId: number };

function emptyContact(rowId: number): ContactDraft {
  return {
    rowId,
    name: "",
    address: "",
    firmOrRelationship: "",
    role: "",
    email: "",
    phone: "",
    primaryOrBackup: "adviser",
    responsibilities: "",
  };
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
  const [contactDrafts, setContactDrafts] = useState<ContactDraft[]>(() =>
    team?.contacts.length
      ? team.contacts.map((contact, index) => ({
          ...contact,
          address: contact.address ?? "",
          rowId: index + 1,
        }))
      : [emptyContact(1)],
  );

  function updateContact<K extends keyof TeamContact>(
    rowId: number,
    field: K,
    value: TeamContact[K],
  ) {
    setContactDrafts((current) =>
      current.map((contact) =>
        contact.rowId === rowId ? { ...contact, [field]: value } : contact,
      ),
    );
  }

  function addContact() {
    setContactDrafts((current) => {
      const nextId = Math.max(...current.map((contact) => contact.rowId), 0) + 1;
      return [...current, emptyContact(nextId)];
    });
  }

  function removeContact(rowId: number) {
    setContactDrafts((current) =>
      current.length === 1
        ? current
        : current.filter((contact) => contact.rowId !== rowId),
    );
  }

  if (section === "financial_range") {
    return (
      <FinancialIntakeForm
        canonical={canonical}
        busy={busy}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

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
        section: "goals_family",
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
        section: "planning_context",
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
    } else {
      const contacts: TeamContact[] = contactDrafts.map(
        (contact) => ({
          name: contact.name.trim(),
          address: contact.address?.trim(),
          firmOrRelationship: contact.firmOrRelationship.trim(),
          role: contact.role.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          primaryOrBackup: contact.primaryOrBackup,
          responsibilities: contact.responsibilities.trim(),
        }),
      );
      if (contacts.some((contact) => !contact.name || !contact.role)) {
        setLocalError("Provide a name and role for each person, or remove the empty entry.");
        return;
      }
      const continuityResponsibilities = checked(data, "continuityResponsibilities");
      if (!continuityResponsibilities.length) {
        setLocalError("Select at least one responsibility that must continue.");
        return;
      }
      submission = {
        operationId: crypto.randomUUID(),
        section: "team_continuity",
        values: {
          contacts,
          missingProfessionalRoles: checked(data, "missingProfessionalRoles"),
          continuityResponsibilities,
          specialAssetsOrPurposes: checked(data, "specialAssetsOrPurposes"),
          readinessPlan: text(data, "readinessPlan"),
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
          <dl className="intake-orientation" aria-label="What to expect">
            <div><dt>Time</dt><dd>About 10–15 minutes</dd></div>
            <div><dt>Helpful now</dt><dd>Family names, current-plan timing, contacts, and broad financial figures</dd></div>
            <div><dt>You receive</dt><dd>A Planning Summary and Estate Blueprint</dd></div>
          </dl>
          <p className="active-prompt-label">Next Question</p>
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
          <p className="active-prompt-label">Next Question</p>
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
      ) : (
        <>
          <p className="active-prompt-label">Next Question</p>
          <h2>Provide contact details for the key people involved in your estate planning.</h2>
          <p>This might include attorneys, tax or financial professionals, assistants, trusted family members, or anyone else who should know what to do.</p>
          <div className="contact-entry-list">
            {contactDrafts.map((contact, index) => (
              <fieldset className="contact-entry" key={contact.rowId}>
                <legend>Person {index + 1}</legend>
                <div className="intake-grid">
                  <Field label="Name"><input value={contact.name} onChange={(event) => updateContact(contact.rowId, "name", event.target.value)} required /></Field>
                  <Field label="Address"><input value={contact.address ?? ""} onChange={(event) => updateContact(contact.rowId, "address", event.target.value)} /></Field>
                  <Field label="Email"><input type="email" value={contact.email} onChange={(event) => updateContact(contact.rowId, "email", event.target.value)} /></Field>
                  <Field label="Phone"><input value={contact.phone} onChange={(event) => updateContact(contact.rowId, "phone", event.target.value)} /></Field>
                  <Field label="Role in the process"><input value={contact.role} onChange={(event) => updateContact(contact.rowId, "role", event.target.value)} required /></Field>
                  <Field label="Firm or relationship"><input value={contact.firmOrRelationship} onChange={(event) => updateContact(contact.rowId, "firmOrRelationship", event.target.value)} /></Field>
                  <Field label="Contact type"><select value={contact.primaryOrBackup} onChange={(event) => updateContact(contact.rowId, "primaryOrBackup", event.target.value as TeamContact["primaryOrBackup"])}><option value="adviser">Adviser</option><option value="participant">Participant</option><option value="primary">Primary decision-maker</option><option value="backup">Backup decision-maker</option></select></Field>
                  <Field label="Responsibilities"><input value={contact.responsibilities} onChange={(event) => updateContact(contact.rowId, "responsibilities", event.target.value)} /></Field>
                </div>
                {contactDrafts.length > 1 ? <button type="button" className="contact-remove" onClick={() => removeContact(contact.rowId)}>Remove person</button> : null}
              </fieldset>
            ))}
          </div>
          <button type="button" className="button button-secondary contact-add" onClick={addContact}>Add another person</button>
          <fieldset className="check-grid"><legend>Professional roles still needed</legend>{["estate-planning attorney", "CPA or tax adviser", "financial adviser", "insurance adviser", "professional fiduciary", "none"].map((item) => <label key={item}><input type="checkbox" name="missingProfessionalRoles" value={item} defaultChecked={team?.missingProfessionalRoles.includes(item)} /> {item}</label>)}</fieldset>
          <fieldset className="check-grid"><legend>Responsibilities that must continue</legend>{["household support", "bill payment", "investment oversight", "business management", "property management", "digital access"].map((item) => <label key={item}><input type="checkbox" name="continuityResponsibilities" value={item} defaultChecked={team ? team.continuityResponsibilities.includes(item) : item === "household support"} /> {item}</label>)}</fieldset>
          <fieldset className="check-grid"><legend>Special assets or purposes</legend>{["business", "real estate", "digital assets", "charitable purpose", "none"].map((item) => <label key={item}><input type="checkbox" name="specialAssetsOrPurposes" value={item} defaultChecked={team?.specialAssetsOrPurposes.includes(item)} /> {item}</label>)}</fieldset>
          <Field label="Family readiness plan"><select name="readinessPlan" defaultValue={team?.readinessPlan || "not decided"} required><option>annual family meeting</option><option>increasing participation with readiness</option><option>professional oversight continues</option><option>not decided</option></select></Field>
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
