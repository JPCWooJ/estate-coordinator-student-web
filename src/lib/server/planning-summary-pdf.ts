import type { MatterOpeningRecord } from "@/lib/domain/matter-opening";
import { OUTCOME_LABELS } from "@/lib/domain/matter-opening";

type SummarySection = {
  title: string;
  body: string[];
};

type PdfLine = {
  text: string;
  size: number;
  gapAfter?: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 54;
const TOP_MARGIN = 740;
const BOTTOM_MARGIN = 48;
const BODY_WRAP_WIDTH = 88;

function normalize(value: string | string[] | null | undefined): string {
  if (!value) return "Not specified";
  if (Array.isArray(value)) {
    return value.length === 0 ? "Not specified" : value.join("; ");
  }
  return value.trim() || "Not specified";
}

function pdfSafeText(value: string): string {
  const normalized = value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\r?\n/g, " ");

  return Array.from(normalized)
    .map((character) => (character.charCodeAt(0) <= 255 ? character : "?"))
    .join("");
}

function escapePdfText(value: string): string {
  return pdfSafeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(value: string, width = BODY_WRAP_WIDTH): string[] {
  const words = pdfSafeText(normalize(value)).split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["Not specified"];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function createSummarySections(record: MatterOpeningRecord): SummarySection[] {
  const contacts = record.professional_and_family_contacts.length
    ? record.professional_and_family_contacts.map((contact) => {
        const contactDetails = [contact.email, contact.telephone]
          .filter((value) => value && value !== "unknown")
          .join(" | ");
        return `${contact.name} - ${contact.firm} - ${contact.estate_role}${
          contactDetails ? ` - ${contactDetails}` : ""
        }`;
      })
    : [record.missing_contacts.length ? record.missing_contacts.join(", ") : "No contact recorded"];

  const participants = record.other_participants.length
    ? record.other_participants.map((person) => person.name)
    : ["None identified"];

  return [
    {
      title: "What you want to accomplish",
      body: [
        ...record.desired_outcomes.map((outcome) => OUTCOME_LABELS[outcome]),
        `Definition of success: ${normalize(record.principal_definition_of_success)}`,
      ],
    },
    {
      title: "Top three priorities",
      body: record.top_three_priorities.map((outcome) => OUTCOME_LABELS[outcome]),
    },
    {
      title: "Priority context",
      body: record.priority_details.length
        ? record.priority_details.map(
            (item) => `${OUTCOME_LABELS[item.outcome]}: ${item.detail}`,
          )
        : ["Not specified"],
    },
    {
      title: "People and interests to protect",
      body: [
        normalize(record.people_and_interests_snapshot),
        ...record.people_circumstance_flags,
      ],
    },
    {
      title: "Current planning context",
      body: [normalize(record.current_plan_snapshot), ...record.changes_since_current_plan],
    },
    {
      title: "Timing and urgency",
      body: [
        normalize(record.timing_event_or_deadline.reason),
        `Event: ${normalize(record.timing_event_or_deadline.event)}`,
        `Date: ${normalize(record.timing_event_or_deadline.date)}`,
      ],
    },
    {
      title: "Household and complexity context",
      body: [normalize(record.geographic_and_complexity_flags)],
    },
    {
      title: "Contacts and team",
      body: contacts,
    },
    {
      title: "People who should help",
      body: participants,
    },
    {
      title: "What would make the plan feel complete",
      body: [normalize(record.house_in_order_concern)],
    },
  ];
}

function buildLines(record: MatterOpeningRecord): PdfLine[] {
  const prepared = new Date().toISOString().slice(0, 10);
  const lines: PdfLine[] = [
    { text: "Estate Planning Summary", size: 18, gapAfter: 8 },
    { text: `Prepared: ${prepared}`, size: 10, gapAfter: 16 },
  ];

  for (const section of createSummarySections(record)) {
    lines.push({ text: section.title, size: 12, gapAfter: 4 });
    for (const body of section.body) {
      for (const wrapped of wrapLine(`- ${body}`)) {
        lines.push({ text: wrapped, size: 10, gapAfter: 2 });
      }
    }
    lines.push({ text: "", size: 8, gapAfter: 8 });
  }

  return lines;
}

function paginate(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let y = TOP_MARGIN;

  for (const line of lines) {
    const lineHeight = line.size + 5 + (line.gapAfter ?? 0);
    if (currentPage.length > 0 && y - lineHeight < BOTTOM_MARGIN) {
      pages.push(currentPage);
      currentPage = [];
      y = TOP_MARGIN;
    }
    currentPage.push(line);
    y -= lineHeight;
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages.length ? pages : [[{ text: "Estate Planning Summary", size: 18 }]];
}

function pageContent(lines: PdfLine[]): string {
  const output: string[] = [];
  let y = TOP_MARGIN;

  for (const line of lines) {
    if (line.text) {
      output.push("BT");
      output.push(`/F1 ${line.size} Tf`);
      output.push(`${LEFT_MARGIN} ${y} Td`);
      output.push(`(${escapePdfText(line.text)}) Tj`);
      output.push("ET");
    }
    y -= line.size + 5 + (line.gapAfter ?? 0);
  }

  return output.join("\n");
}

function buildPdf(pages: PdfLine[][]): Buffer {
  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2);
  const objects: string[] = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectNumbers
      .map((number) => `${number} 0 R`)
      .join(" ")}] /Count ${pages.length} >>\nendobj`,
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`,
  ];

  pages.forEach((page, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    const content = pageContent(page);
    objects.push(
      `${pageObject} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>\nendobj`,
    );
    objects.push(
      `${contentObject} 0 obj\n<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream\nendobj`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  const xrefEntries = [
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  ].join("\n");
  pdf += `xref\n0 ${objects.length + 1}\n${xrefEntries}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

export function buildPlanningSummaryPdf(record: MatterOpeningRecord): Buffer {
  return buildPdf(paginate(buildLines(record)));
}
