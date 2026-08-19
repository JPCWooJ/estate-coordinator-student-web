import type { MatterOpeningRecord } from "@/lib/domain/matter-opening";
import { buildPrincipalPlanningSummary } from "@/lib/domain/planning-summary";

export function OpeningSummary({ record }: { record: MatterOpeningRecord }) {
  const summary = buildPrincipalPlanningSummary(record);
  return (
    <div className="summary-grid">
      <section>
        <h3>What you want to accomplish</h3>
        <ul>
          {summary.desiredOutcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Top three priorities</h3>
        <ol>
          {summary.topPriorities.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ol>
      </section>
      <section className="summary-wide">
        <h3>Your definition of success</h3>
        <p>{summary.successDefinition}</p>
      </section>
      <section className="summary-wide">
        <h3>Priority context</h3>
        {summary.priorityContext.length ? (
          <dl className="detail-list">
            {summary.priorityContext.map((item) => (
              <div key={`${item.outcome}-${item.detail}`}>
                <dt>{item.outcome}</dt>
                <dd>{item.detail}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Not yet known</p>
        )}
      </section>
      <section>
        <h3>People and interests to protect</h3>
        <p>{summary.peopleAndInterests}</p>
        {summary.peopleFlags.length > 0 && (
          <p className="summary-note">
            Flags: {summary.peopleFlags.join(", ")}
          </p>
        )}
      </section>
      <section>
        <h3>Current planning context</h3>
        <p>{summary.currentPlanStatus}</p>
        <p>{summary.currentPlanSnapshot}</p>
      </section>
      <section>
        <h3>Known planning changes</h3>
        <ul>
          {summary.knownChanges.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Timing and urgency</h3>
        <p>{summary.timing.reason}</p>
        <p className="summary-note">
          Event: {summary.timing.event}
        </p>
        <p className="summary-note">
          Date: {summary.timing.date}
        </p>
        <p className="summary-note">
          Importance: {summary.timing.importance}
        </p>
      </section>
      <section>
        <h3>Timing and material complexity</h3>
        <p>
          {summary.complexityFlags.length ? summary.complexityFlags.join("; ") : "Not yet known"}
        </p>
      </section>
      <section className="summary-wide">
        <h3>Contacts and team</h3>
        {summary.contacts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Firm</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {summary.contacts.map((contact, index) => (
                  <tr key={`${contact.name}-${index}`}>
                    <td>{contact.name}</td>
                    <td>{contact.firm}</td>
                    <td>{contact.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {summary.missingContacts.length
              ? summary.missingContacts.join(", ")
              : "No contact recorded"}
          </p>
        )}
      </section>
      <section>
        <h3>People who should help</h3>
        <p>
          {summary.participants.length
            ? summary.participants.join("; ")
            : "None identified"}
        </p>
      </section>
      <section className="summary-wide">
        <h3>Recommended next step</h3>
        <p>{summary.recommendedNextStep}</p>
      </section>
    </div>
  );
}
