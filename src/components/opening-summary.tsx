import type { MatterOpeningRecord } from "@/lib/domain/matter-opening";
import { buildPrincipalPlanningSummary } from "@/lib/domain/planning-summary";

export function OpeningSummary({ record }: { record: MatterOpeningRecord }) {
  const summary = buildPrincipalPlanningSummary(record);
  return (
    <div className="summary-grid professional-summary">
      {summary.sections.map((section) => (
        <section className="summary-wide" key={section.key} data-summary-section={section.key}>
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
