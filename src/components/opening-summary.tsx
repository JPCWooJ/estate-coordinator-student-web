import type { MatterOpeningRecord } from "@/lib/domain/matter-opening";
import { OUTCOME_LABELS } from "@/lib/domain/matter-opening";

function valueOrUnknown(value: string) {
  return value && value !== "unknown" ? value : "Not yet known";
}

export function OpeningSummary({ record }: { record: MatterOpeningRecord }) {
  return (
    <div className="summary-grid">
      <section>
        <h3>Desired outcomes</h3>
        <ul>
          {record.desired_outcomes.map((outcome) => (
            <li key={outcome}>{OUTCOME_LABELS[outcome]}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Top three priorities</h3>
        <ol>
          {record.top_three_priorities.map((outcome) => (
            <li key={outcome}>{OUTCOME_LABELS[outcome]}</li>
          ))}
        </ol>
      </section>
      <section className="summary-wide">
        <h3>Definition of success</h3>
        <p>{valueOrUnknown(record.principal_definition_of_success)}</p>
      </section>
      <section className="summary-wide">
        <h3>Priority details</h3>
        {record.priority_details.length ? (
          <dl className="detail-list">
            {record.priority_details.map((item) => (
              <div key={item.outcome}>
                <dt>{OUTCOME_LABELS[item.outcome]}</dt>
                <dd>{item.detail}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Not yet known</p>
        )}
      </section>
      <section>
        <h3>People and interests</h3>
        <p>{valueOrUnknown(record.people_and_interests_snapshot)}</p>
        {record.people_circumstance_flags.length > 0 && (
          <p className="summary-note">
            Flags: {record.people_circumstance_flags.join(", ")}
          </p>
        )}
      </section>
      <section>
        <h3>Current plan</h3>
        <p>{valueOrUnknown(record.current_plan_snapshot)}</p>
        <p className="summary-note">
          Classification: {record.matter_classification.replaceAll("_", " ")}
        </p>
      </section>
      <section>
        <h3>Timing</h3>
        <p>{valueOrUnknown(record.timing_event_or_deadline.reason)}</p>
        <p className="summary-note">
          Event: {valueOrUnknown(record.timing_event_or_deadline.event)}
        </p>
      </section>
      <section>
        <h3>Geographic and complexity footprint</h3>
        <p>
          {record.geographic_and_complexity_flags.length
            ? record.geographic_and_complexity_flags.join("; ")
            : "Not yet known"}
        </p>
      </section>
      <section className="summary-wide">
        <h3>Estate team and family contacts</h3>
        {record.professional_and_family_contacts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Firm</th>
                  <th>Role</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {record.professional_and_family_contacts.map((contact, index) => (
                  <tr key={`${contact.name}-${index}`}>
                    <td>{contact.name}</td>
                    <td>{contact.firm}</td>
                    <td>{contact.estate_role}</td>
                    <td>
                      {contact.email} · {contact.telephone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {record.missing_contacts.length
              ? record.missing_contacts.join(", ")
              : "No contact recorded"}
          </p>
        )}
      </section>
      <section>
        <h3>Other participants</h3>
        <p>
          {record.other_participants.length
            ? record.other_participants.map((person) => person.name).join("; ")
            : "None identified"}
        </p>
      </section>
      <section>
        <h3>House-in-order concern</h3>
        <p>{valueOrUnknown(record.house_in_order_concern)}</p>
      </section>
      <section>
        <h3>Recommended discovery path</h3>
        <p>{valueOrUnknown(record.selected_discovery_path)}</p>
      </section>
      <section>
        <h3>Single next action</h3>
        <p>{valueOrUnknown(record.single_next_action)}</p>
      </section>
    </div>
  );
}
