import type { MatterOpeningRecord } from "@/lib/domain/matter-opening";
import type { IntakeSection } from "@/lib/domain/intake";
import { buildPrincipalPlanningSummary } from "@/lib/domain/planning-summary";

type EditableSection = Exclude<IntakeSection, "planning_summary">;

export function OpeningSummary({
  record,
  onEdit,
}: {
  record: MatterOpeningRecord;
  onEdit?: (section: EditableSection) => void;
}) {
  const summary = buildPrincipalPlanningSummary(record);
  return (
    <>
      <div className="summary-grid professional-summary">
        {summary.sections.map((section) => (
          <section
            className="summary-wide"
            key={section.key}
            data-summary-section={section.key}
          >
            <div className="summary-section-heading">
              <h3>{section.title}</h3>
              {onEdit && section.editSection ? (
                <button
                  type="button"
                  className="summary-correction"
                  aria-label={`Correct ${section.title.toLowerCase()}`}
                  onClick={() => onEdit(section.editSection!)}
                >
                  Correct this section
                </button>
              ) : null}
            </div>

            {section.contacts ? (
              section.contacts.length ? (
                <div className="table-wrap summary-contacts">
                  <table>
                    <caption>Contacts</caption>
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Contact</th>
                        <th scope="col">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.contacts.map((contact, index) => (
                        <tr key={`${contact.name}-${index}`}>
                          <td>
                            <strong>{contact.name}</strong>
                            <span>{contact.affiliation}</span>
                          </td>
                          <td>{contact.contact}</td>
                          <td>
                            <strong>{contact.role}</strong>
                            <span>{contact.responsibilities}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="summary-empty">No contact recorded.</p>
              )
            ) : null}

            <dl className="summary-details">
              {section.details.map((item, index) => (
                <div key={`${item.label}-${index}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <aside className="summary-boundary" aria-label="Professional boundary">
        <strong>Professional boundary</strong>
        <p>{summary.boundaryNote}</p>
      </aside>
    </>
  );
}
