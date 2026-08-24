import { afterEach, describe, expect, it, vi } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";

import type { BlueprintDocument } from "@/lib/domain/blueprint";
import { renderBlueprintPdf } from "./blueprint-pdf";

vi.mock("server-only", () => ({}));

const document: BlueprintDocument = {
  source_snapshot_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Estate Blueprint",
  report_type: "Estate Planning Report",
  subtitle: "Target-State Design for My Estate Plan",
  organization_name: "Estate Coordinator",
  prepared_by: "Estate Coordinator",
  version_status: "Principal-confirmed target-state design",
  date: "August 23, 2026",
  confidentiality_line: "Confidential. My Estate Plan.",
  advice_boundary:
    "This Estate Blueprint organizes planning direction. It is not legal, tax, valuation, GST, or other professional advice.",
  estate_team: [
    {
      name: "Jordan Lee",
      firm_or_relationship: "Harbor Counsel",
      role: "Estate-planning counsel",
      contact: "contact@harborcounsel.com | 555-555-1111",
    },
    {
      name: "Spouse",
      firm_or_relationship: "Family",
      role: "Planning participant",
      contact: "Contact to be confirmed",
    },
  ],
  sections: [
    {
      key: "at_a_glance",
      title: "Your Estate Blueprint - At a Glance",
      overview: ["Protect the family and preserve lifetime security."],
      objectives: ["Protect beneficiaries", "Maintain continuity"],
      governing_constraints: ["Preserve $6 million for lifetime security."],
      planning_baseline: [
        { label: "Estate range", value: "$8 million to $10 million" },
      ],
      schematic: {
        nodes: ["Planning base", "Protected beneficiary structure"],
        flows: ["Confirmed direction -> professional implementation"],
      },
    },
    {
      key: "plan_works",
      title: "How Your Plan Works",
      components: [
        {
          title: "Beneficiary structure",
          what_it_does: "Uses a continuing trust for each child.",
          why_it_fits: "Adds protection while preserving useful access.",
          tradeoff_or_dependency: "Counsel must confirm final provisions.",
        },
        ...[
          "Fiduciary and continuity structure",
          "Special-asset continuity",
          "Family-readiness design",
          "Tax and lifetime-transfer direction",
          "Administration and estate liquidity",
        ].map((title) => ({
          title,
          what_it_does:
            "Coordinates the confirmed planning direction with the people, specialized assets, beneficiary designations, liquidity sources, and essential household and investment responsibilities involved.",
          why_it_fits:
            "Supports the principal's confirmed priorities while preserving lifetime security, continuity, protected access, and a practical path toward professional implementation.",
          tradeoff_or_dependency:
            "The appropriate legal, tax, valuation, or financial professional must confirm final design, authority, ownership, and implementation details.",
        })),
      ],
      operating_detail_note:
        "Final drafting, ownership, and implementation remain with the appropriate professionals.",
    },
    {
      key: "confirmations",
      title: "What Still Needs to Be Confirmed",
      items: [
        {
          question: "Counsel must confirm final provisions.",
          why_it_matters: "This affects final drafting and implementation.",
          owner: "Estate-planning counsel",
        },
        ...Array.from({ length: 7 }, (_, index) => ({
          question: `Professional confirmation ${index + 2} must resolve the material ownership, authority, valuation, liquidity, and implementation questions before action is taken.`,
          why_it_matters:
            "This affects final drafting, ownership, tax treatment, valuation, liquidity, or implementation.",
          owner: index % 2 ? "Financial adviser" : "Estate-planning counsel",
        })),
      ],
      approval_boundary: "No implementation occurs without principal approval.",
      existing_plan_boundary:
        "The existing plan has not yet been reviewed against this target state.",
    },
    {
      key: "next_steps",
      title: "What Happens Next",
      steps: ["Share this Blueprint with estate-planning counsel."],
      decisions_already_made: [
        "Use protected beneficiary structures with readiness-based participation.",
        "Separate family judgment from independent fiduciary administration.",
        "Maintain special-asset continuity and named backups.",
        "Model transfers only above the lifetime-security boundary.",
        "Coordinate ownership and beneficiary designations with the administrative hub.",
        "Confirm a practical source of estate liquidity before implementation.",
      ],
      concrete_next_action: "Schedule the professional design review.",
    },
  ],
};

let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;

afterEach(async () => {
  const destroy = (pdf as unknown as { destroy?: () => Promise<void> } | null)
    ?.destroy;
  if (typeof destroy === "function") await destroy.call(pdf);
  pdf = null;
});

describe("Estate Blueprint PDF", () => {
  it("renders the frozen web document as a readable principal-facing PDF", async () => {
    const bytes = await renderBlueprintPdf(document);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    pdf = await getDocumentProxy(bytes);
    expect(pdf.numPages).toBeLessThanOrEqual(11);
    const extracted = await extractText(pdf, { mergePages: true });
    expect(extracted.text).toContain("Estate Blueprint");
    expect(extracted.text).toContain("Your Estate Blueprint - At a Glance");
    expect(extracted.text).toContain("How Your Plan Works");
    expect(extracted.text).toContain("What Still Needs to Be Confirmed");
    expect(extracted.text).toContain("What Happens Next");
    expect(extracted.text).toContain("not legal, tax, valuation");

    const paged = await extractText(pdf);
    const pageTextLengths = paged.text.map(
      (page) => page.replace(/\s+/g, " ").trim().length,
    );
    expect(pageTextLengths[0]).toBeGreaterThanOrEqual(150);
    expect(
      Math.min(...pageTextLengths.slice(1)),
      JSON.stringify(pageTextLengths),
    ).toBeGreaterThanOrEqual(250);
  }, 30_000);
});
