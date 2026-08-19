import type { MatterOpeningRecord } from "@/lib/domain/matter-opening";
import { buildPrincipalPlanningSummary } from "@/lib/domain/planning-summary";

type PdfLine = {
  text: string;
  size: number;
  x: number;
  y: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 54;
const RIGHT_MARGIN = 54;
const TOP_MARGIN = 740;
const BOTTOM_MARGIN = 64;
const TITLE_SIZE = 18;
const HEADING_SIZE = 12;
const BODY_SIZE = 10;

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

function normalize(value: string | string[] | null | undefined): string {
  if (!value) return "Not yet known";
  if (Array.isArray(value)) return value.length === 0 ? "Not yet known" : value.join("; ");
  const cleaned = value.trim();
  return cleaned.length ? cleaned : "Not yet known";
}

function wrapLines(value: string, fontSize: number, indent: number): string[] {
  const words = normalize(value).replace(/\s+/g, " ").split(" ");
  const maxChars = Math.max(32, Math.floor((PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN - indent) / (fontSize * 0.52)));
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (word.length > maxChars) {
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function pushLine(
  lines: PdfLine[][],
  line: string,
  state: { y: number; value: PdfLine[][] },
  options: { size: number; indent: number },
) {
  const pages = state.value;
  let currentPage = pages[pages.length - 1]!;
  const wrapped = wrapLines(line, options.size, options.indent);
  const indent = LEFT_MARGIN + options.indent;
  let y = state.y;

  for (const entry of wrapped) {
    if (y <= BOTTOM_MARGIN) {
      pages.push([]);
      currentPage = pages[pages.length - 1]!;
      y = TOP_MARGIN;
    }
    currentPage.push({
      text: entry,
      size: options.size,
      x: indent,
      y,
    });
    y -= options.size + 4;
  }

  state.y = y;
}

function pushSection(
  lines: PdfLine[][],
  state: { y: number; value: PdfLine[][] },
  title: string,
  values: string[],
) {
  if (state.y <= BOTTOM_MARGIN + 20) {
    lines.push([]);
    state.y = TOP_MARGIN;
  }

  pushLine(lines, title, state, { size: HEADING_SIZE, indent: 0 });
  state.y -= 4;
  for (const value of values) {
    pushLine(lines, `• ${value}`, state, { size: BODY_SIZE, indent: 14 });
  }
  state.y -= 6;
}

function createPdfContent(record: MatterOpeningRecord): PdfLine[][] {
  const summary = buildPrincipalPlanningSummary(record);
  const pages: PdfLine[][] = [[]];
  const state: { y: number; value: PdfLine[][] } = { y: TOP_MARGIN, value: pages };

  const contactPeople: string[] = [];
  if (summary.contacts.length) {
    for (const contact of summary.contacts) {
      contactPeople.push(`${contact.name} — ${contact.firm} (${contact.role})`);
    }
  }
  for (const participant of summary.participants) {
    contactPeople.push(`Participant: ${normalize(participant)}`);
  }
  if (summary.missingContacts.length) {
    contactPeople.push(`Missing: ${summary.missingContacts.join(", ")}`);
  }
  if (!contactPeople.length) contactPeople.push("Not yet identified");

  const sections: Array<{ title: string; values: string[] }> = [
    {
      title: "What you want to accomplish",
      values: [
        ...summary.desiredOutcomes,
        `Success priority: ${summary.successDefinition}`,
      ],
    },
    {
      title: "Top three priorities",
      values: summary.topPriorities.length > 0
        ? summary.topPriorities
        : ["Not yet known"],
    },
    {
      title: "People and interests",
      values: [normalize(summary.peopleAndInterests)],
    },
    {
      title: "People and circumstance flags",
      values: summary.peopleFlags,
    },
    {
      title: "Current planning context",
      values: [
        normalize(summary.currentPlanSnapshot),
        `Current plan status: ${normalize(summary.currentPlanStatus)}`,
      ],
    },
    {
      title: "Known planning changes",
      values: summary.knownChanges,
    },
    {
      title: "Timing and urgency",
      values: [
        `Reason: ${normalize(summary.timing.reason)}`,
        `Event: ${normalize(summary.timing.event)}`,
        `Date: ${normalize(summary.timing.date)}`,
        `Importance: ${normalize(summary.timing.importance)}`,
      ],
    },
    {
      title: "Timing and material complexity",
      values: summary.complexityFlags,
    },
    {
      title: "People who should help",
      values: contactPeople,
    },
    {
      title: "Recommended next step",
      values: [summary.recommendedNextStep],
    },
  ];

  pushLine(pages, "Estate Planning Summary", state, {
    size: TITLE_SIZE,
    indent: 0,
  });
  pushLine(pages, `Prepared: ${new Date(record.opened_on).toLocaleDateString()}`, state, {
    size: BODY_SIZE,
    indent: 0,
  });
  state.y -= 8;

  for (const section of sections) {
    pushSection(pages, state, section.title, section.values);
  }

  const activePage = state.value[state.value.length - 1]!;
  if (activePage.length === 0 && state.value.length > 1) {
    state.value.pop();
  }
  return state.value;
}

function buildPageStream(lines: PdfLine[]): string {
  const commands: string[] = ["BT", "0 0 0 rg"];
  for (const line of lines) {
    commands.push(`/${"F1"} ${line.size} Tf`);
    commands.push(`1 0 0 1 ${line.x.toFixed(2)} ${line.y.toFixed(2)} Tm`);
    commands.push(`(${escapePdfText(line.text)}) Tj`);
  }
  commands.push("ET");
  return `${commands.join("\n")}\n`;
}

export function buildPlanningSummaryPdf(record: MatterOpeningRecord): Buffer {
  const pages = createPdfContent(record).filter((page) => page.length > 0);
  const pageObjectStart = 4;
  const contentObjectStart = 5;
  const pageCount = Math.max(1, pages.length);
  const pageObjectIds = Array.from(
    { length: pageCount },
    (_, index) => pageObjectStart + index * 2,
  );
  const contentObjectIds = Array.from(
    { length: pageCount },
    (_, index) => contentObjectStart + index * 2,
  );
  const objects: string[] = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj`,
  );
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

  for (const [index, lines] of pages.entries()) {
    const pageId = pageObjectIds[index] ?? pageObjectStart + index * 2;
    const contentId = contentObjectIds[index] ?? contentObjectStart + index * 2;
    const stream = buildPageStream(lines);
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`,
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj`,
    );
  }

  let pdf = "%PDF-1.4\n";
  const xrefOffsets: number[] = [];

  for (const object of objects) {
    xrefOffsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }

  const startXref = Buffer.byteLength(pdf, "utf8");
  const xrefEntries = [
    "0000000000 65535 f ",
    ...xrefOffsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  ];

  pdf += `xref\n0 ${objects.length + 1}\n${xrefEntries.join("\n")}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
