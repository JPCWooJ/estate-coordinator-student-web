import "server-only";

import { join } from "node:path";

import {
  Document,
  Font,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { BlueprintDocument } from "@/lib/domain/blueprint";

function arimoFontPath(filename: string) {
  return join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "arimo",
    "files",
    filename,
  );
}

Font.register({
  family: "Arial",
  fonts: [
    {
      src: arimoFontPath("arimo-latin-400-normal.woff"),
      fontWeight: 400,
    },
    {
      src: arimoFontPath("arimo-latin-400-italic.woff"),
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: arimoFontPath("arimo-latin-700-normal.woff"),
      fontWeight: 700,
    },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const COLORS = {
  ink: "#172333",
  navy: "#21374F",
  blue: "#2E5E7E",
  cream: "#F8F4EC",
  gold: "#B99145",
  muted: "#667487",
  line: "#D8DEE5",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    color: COLORS.ink,
    fontFamily: "Arial",
    fontSize: 10,
    lineHeight: 1.5,
    paddingTop: 66,
    paddingBottom: 54,
    paddingHorizontal: 54,
  },
  cover: {
    backgroundColor: COLORS.navy,
    color: COLORS.white,
    fontFamily: "Arial",
    padding: 66,
  },
  coverRule: {
    backgroundColor: COLORS.gold,
    height: 5,
    marginBottom: 52,
    width: 76,
  },
  eyebrow: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.8,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  coverTitle: {
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 1.08,
    marginBottom: 16,
  },
  coverSubtitle: {
    color: "#DDE7EF",
    fontSize: 17,
    lineHeight: 1.35,
    marginBottom: 42,
    maxWidth: 390,
  },
  coverMeta: {
    borderTopColor: "#51677D",
    borderTopWidth: 1,
    color: "#DDE7EF",
    fontSize: 10,
    marginTop: "auto",
    paddingTop: 18,
  },
  header: {
    alignItems: "center",
    borderBottomColor: COLORS.line,
    borderBottomWidth: 1,
    color: COLORS.muted,
    flexDirection: "row",
    fontSize: 8,
    justifyContent: "space-between",
    left: 54,
    paddingBottom: 9,
    position: "absolute",
    right: 54,
    top: 30,
  },
  footer: {
    borderTopColor: COLORS.line,
    borderTopWidth: 1,
    color: COLORS.muted,
    flexDirection: "row",
    fontSize: 7.5,
    justifyContent: "space-between",
    left: 54,
    paddingTop: 8,
    position: "absolute",
    right: 54,
    top: 744,
  },
  sectionEyebrow: {
    color: COLORS.blue,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.4,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  h1: {
    color: COLORS.navy,
    fontSize: 23,
    fontWeight: 700,
    lineHeight: 1.18,
    marginBottom: 18,
  },
  h2: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 7,
  },
  body: { marginBottom: 8 },
  bulletRow: { flexDirection: "row", marginBottom: 5 },
  bullet: { color: COLORS.gold, fontWeight: 700, width: 14 },
  bulletText: { flex: 1 },
  panel: {
    backgroundColor: COLORS.cream,
    borderLeftColor: COLORS.gold,
    borderLeftWidth: 3,
    marginBottom: 14,
    padding: 13,
  },
  card: {
    borderColor: COLORS.line,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 12,
    padding: 13,
  },
  label: {
    color: COLORS.blue,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.7,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  value: { marginBottom: 8 },
  flow: {
    alignItems: "stretch",
    flexDirection: "row",
    marginVertical: 14,
  },
  flowNode: {
    backgroundColor: COLORS.navy,
    color: COLORS.white,
    flex: 1,
    fontSize: 8.5,
    justifyContent: "center",
    minHeight: 52,
    padding: 10,
    textAlign: "center",
  },
  flowArrow: {
    alignSelf: "center",
    color: COLORS.gold,
    fontSize: 17,
    paddingHorizontal: 7,
  },
  boundary: {
    backgroundColor: "#EEF3F6",
    color: COLORS.navy,
    fontSize: 9,
    marginTop: 12,
    padding: 11,
  },
  teamRow: {
    borderBottomColor: COLORS.line,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  teamName: { color: COLORS.navy, fontWeight: 700 },
});

function Header({ document }: { document: BlueprintDocument }) {
  return (
    <>
      <View fixed style={styles.header}>
        <Text>{document.organization_name}</Text>
        <Text>{document.report_type}</Text>
      </View>
      <View fixed style={styles.footer}>
        <Text>{document.confidentiality_line}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </View>
    </>
  );
}

function Bullets({ items }: { items: string[] }) {
  return items.map((item) => (
    <View key={item} style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function BlueprintPdfDocument({ document }: { document: BlueprintDocument }) {
  const [atAGlance, planWorks, confirmations, nextSteps] = document.sections;
  const planPages = chunkItems(planWorks.components, 2);
  const confirmationPages = chunkItems(confirmations.items, 3);
  return (
    <Document
      author={document.prepared_by}
      creator={document.organization_name}
      language="en-US"
      subject={document.subtitle}
      title={document.title}
    >
      <Page size="LETTER" style={styles.cover}>
        <View style={styles.coverRule} />
        <Text style={styles.eyebrow}>{document.report_type}</Text>
        <Text style={styles.coverTitle}>{document.title}</Text>
        <Text style={styles.coverSubtitle}>{document.subtitle}</Text>
        <View style={styles.panel}>
          <Text style={[styles.label, { color: COLORS.gold }]}>Version status</Text>
          <Text style={{ color: COLORS.ink }}>{document.version_status}</Text>
        </View>
        <Text style={styles.coverMeta}>
          Prepared by {document.prepared_by}  |  {document.date}{"\n"}
          {document.confidentiality_line}
        </Text>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Header document={document} />
        <Text style={styles.sectionEyebrow}>Section 1</Text>
        <Text style={styles.h1}>{atAGlance.title}</Text>
        {atAGlance.overview.map((paragraph) => (
          <Text key={paragraph} style={styles.body}>{paragraph}</Text>
        ))}
        <View style={styles.panel} wrap={false}>
          <Text style={styles.h2}>Core objectives</Text>
          <Bullets items={atAGlance.objectives} />
        </View>
        <Text style={styles.h2}>Planning baseline</Text>
        {atAGlance.planning_baseline.map((item) => (
          <View key={item.label} style={styles.card} wrap={false}>
            <Text style={styles.label}>{item.label}</Text>
            <Text>{item.value}</Text>
          </View>
        ))}
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Header document={document} />
        <Text style={styles.sectionEyebrow}>Section 1 continued</Text>
        <Text style={styles.h1}>Governing constraints and planning flow</Text>
        <Bullets items={atAGlance.governing_constraints} />
        <View style={styles.flow} wrap={false}>
          {atAGlance.schematic.nodes.map((node, index) => (
            <View key={node} style={{ flexDirection: "row", flex: 1 }}>
              <View style={styles.flowNode}><Text>{node}</Text></View>
              {index < atAGlance.schematic.nodes.length - 1 ? (
                <Text style={styles.flowArrow}>{">"}</Text>
              ) : null}
            </View>
          ))}
        </View>
        <Bullets items={atAGlance.schematic.flows} />
      </Page>

      {planPages.map((components, pageIndex) => (
        <Page key={`plan-${pageIndex}`} size="LETTER" style={styles.page}>
          <Header document={document} />
          <Text style={styles.sectionEyebrow}>
            {pageIndex === 0 ? "Section 2" : "Section 2 continued"}
          </Text>
          <Text style={styles.h1}>
            {pageIndex === 0 ? planWorks.title : `${planWorks.title} - Continued`}
          </Text>
          {components.map((component) => (
            <View key={component.title} style={styles.card} wrap={false}>
              <Text style={styles.h2}>{component.title}</Text>
              <Text style={styles.label}>What it does</Text>
              <Text style={styles.value}>{component.what_it_does}</Text>
              <Text style={styles.label}>Why it fits</Text>
              <Text style={styles.value}>{component.why_it_fits}</Text>
              <Text style={styles.label}>Tradeoff or dependency</Text>
              <Text>{component.tradeoff_or_dependency}</Text>
            </View>
          ))}
          {pageIndex === planPages.length - 1 ? (
            <Text style={styles.boundary}>{planWorks.operating_detail_note}</Text>
          ) : null}
        </Page>
      ))}

      {(confirmationPages.length ? confirmationPages : [[]]).map((items, pageIndex) => (
        <Page key={`confirmation-${pageIndex}`} size="LETTER" style={styles.page}>
          <Header document={document} />
          <Text style={styles.sectionEyebrow}>
            {pageIndex === 0 ? "Section 3" : "Section 3 continued"}
          </Text>
          <Text style={styles.h1}>
            {pageIndex === 0 ? confirmations.title : `${confirmations.title} - Continued`}
          </Text>
          {pageIndex === 0 ? (
            <View style={styles.panel} wrap={false}>
              <Text style={styles.h2}>Approval and review boundaries</Text>
              <Text style={styles.value}>{confirmations.approval_boundary}</Text>
              <Text>{confirmations.existing_plan_boundary}</Text>
            </View>
          ) : null}
          {items.length ? items.map((item) => (
            <View key={`${item.question}-${item.owner}`} style={styles.card} wrap={false}>
              <Text style={styles.h2}>{item.question}</Text>
              <Text style={styles.label}>Why it matters</Text>
              <Text style={styles.value}>{item.why_it_matters}</Text>
              <Text style={styles.label}>Owner</Text>
              <Text>{item.owner}</Text>
            </View>
          )) : <Text style={styles.body}>No material open confirmations remain.</Text>}
        </Page>
      ))}

      <Page size="LETTER" style={styles.page}>
        <Header document={document} />
        <Text style={styles.sectionEyebrow}>Section 4</Text>
        <Text style={styles.h1}>{nextSteps.title}</Text>
        <Text style={styles.boundary}>{document.advice_boundary}</Text>
        <Text style={styles.h2}>Sequence</Text>
        <Bullets items={nextSteps.steps} />
        <Text style={styles.h2}>Decisions already made</Text>
        <Bullets items={nextSteps.decisions_already_made} />
        {!document.estate_team.length ? (
          <View style={styles.panel} wrap={false}>
            <Text style={styles.label}>Concrete next action</Text>
            <Text>{nextSteps.concrete_next_action}</Text>
          </View>
        ) : null}
      </Page>

      {document.estate_team.length ? (
        <Page size="LETTER" style={styles.page}>
          <Header document={document} />
          <Text style={styles.sectionEyebrow}>Section 4 continued</Text>
          <Text style={styles.h1}>Your estate team and next action</Text>
          {document.estate_team.map((member) => (
            <View key={`${member.name}-${member.role}`} style={styles.teamRow} wrap={false}>
              <Text style={styles.teamName}>{member.name}</Text>
              <Text>{member.role} | {member.firm_or_relationship}</Text>
              <Text>{member.contact}</Text>
            </View>
          ))}
          <View style={styles.panel} wrap={false}>
            <Text style={styles.label}>Concrete next action</Text>
            <Text>{nextSteps.concrete_next_action}</Text>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}

export async function renderBlueprintPdf(document: BlueprintDocument) {
  const buffer = await renderToBuffer(
    <BlueprintPdfDocument document={document} />,
  );
  return new Uint8Array(buffer);
}
