import type { MatterOpeningRecord } from "@/lib/domain/matter-opening";
import { OUTCOME_LABELS } from "@/lib/domain/matter-opening";

type SummarySection = {
  title: string;
  body: string[];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 54;
const TOP_MARGIN = 740;
const DEFAULT_TEXT_WRAP_WIDTH = 92;

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

function normalize(value: string | string[] | null | undefined): string {
  if (!value) return "Not specified";
  if (Array.isArray(value)) {
    return value.length === 0 ? "Not specified" : value.join("; ");
  }
  return value.trim() || "Not specified";
}

function wrapLine(value: string, width: number): string[] {
  const cleanValue = normalize(value);
  const words = cleanValue.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function createSummarySections(record: MatterOpeningRecord): SummarySection[] {
  return [
    {
      title: "What you want to accomplish",
      body: [
        ...record.desired_outcomes.map((outcome) => OUTCOME_LABELS[outcome]),
        `Success priority: ${normalize(record.principal_definition_of_success)}`,
      ],
    },
    {
      title: "Top three priorities",
      body: record.top_three_priorities.map((outcome) => OUTCOME_LABELS[outcome]),
    },
    {
      title: "People and interests",
      body: [
        normalize(record.people_and_interests_snapshot),
        ...record.people_circumstance_flags,
      ],
    },
    {
      title: "Current planning context",
      body: [
        normalize(record.current_plan_snapshot),
        `Current status: ${record.current_plan_status.replaceAll("_", " ")}`,
      ],
    },
    {
      title: "Timing and urgency",
      body: [
        normalize(record.timing_event_or_deadline.reason),
        `Event: ${normalize(record.timing_event_or_deadline.event)}`,
        `Date: ${normalize(record.timing_event_or_deadline.date)}`,
        `Importance: ${normalize(record.timing_event_or_deadline.importance)}`,
      ],
    },
    {
      title: "Household and complexity context",
      body: [normalize(record.geographic_and_complexity_flags)],
    },
    {
      title: "Contacts and participants",
      body: [
        record.professional_and_family_contacts.length
          ? record.professional_and_family_contacts
              .map(
                (contact) =>
                  `${contact.name} — ${contact.firm} (${contact.estate_role}): ${contact.email} ${contact.telephone}`,
              )
              .join("; ")
          : "No contacts recorded",
        normalize(record.other_participants.map((person) => person.name).join(", ")),
      ],
    },
    {
      title: "What would make this feel complete",
      body: [normalize(record.house_in_order_concern)],
    },
    {
      title: "Next planning focus",
      body: [
        normalize(record.selected_discovery_path),
        normalize(record.single_next_action),
      ],
    },
  ];
}

function appendTextLine(
  lines: string[],
  x: number,
  y: number,
  size: number,
  text: string,
): void {
  lines.push("BT");
  lines.push(`/F1 ${size} Tf`);
  lines.push(`${x} ${y} Td`);
  lines.push(`(${escapePdfText(text)}) Tj`);
  lines.push("ET");
}

function buildPdfFromText(lines: string[]): Buffer {
  const wrapped: string[] = [];
  for (const line of lines) {
    for (const chunk of wrapLine(line, DEFAULT_TEXT_WRAP_WIDTH)) {
      wrapped.push(chunk);
    }
  }

  const streamLines: string[] = [];
  let y = TOP_MARGIN;
  for (const [index, line] of wrapped.entries()) {
    if (y < 40) break;
    const size = index === 0 ? 18 : index <= 1 ? 11 : 10;
    const text = size === 18 || line.startsWith("•") ? line : line;
    appendTextLine(
      streamLines,
      LEFT_MARGIN,
      y,
      size,
      text,
    );
    y -= size + 14;
  }

  const content = streamLines.join("\n");
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >> endobj`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
  ];

  const head = "%PDF-1.4\n";
  let pdf = head;
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  }

  const trailerStart = Buffer.byteLength(pdf);
  const xrefEntries = [
    `0000000000 65535 f `,
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  ].join("\n");
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries}\n`;
  const trailer = [
    `trailer`,
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref`,
    String(trailerStart),
    `%%EOF`,
  ].join("\n");

  return Buffer.from(`${pdf}${xref}${trailer}`, "utf8");
}

export function buildPlanningSummaryPdf(record: MatterOpeningRecord): Buffer {
  const sections = createSummarySections(record);
  const textLines: string[] = [
    "Estate Planning Summary",
    `Prepared: ${new Date().toLocaleDateString()}`,
    "",
    ...sections.flatMap((section) => {
      const lines: string[] = [section.title];
      for (const body of section.body) {
        if (body.includes(";")) {
          for (const piece of body.split(";")) {
            lines.push(`• ${piece.trim()}`);
          }
        } else {
          lines.push(`• ${body}`);
        }
      }
      lines.push("");
      return lines;
    }),
  ];

  return buildPdfFromText(textLines);
}
