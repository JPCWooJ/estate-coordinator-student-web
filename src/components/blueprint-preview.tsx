import type { BlueprintDocument } from "@/lib/domain/blueprint";

export function BlueprintPreview({
  document,
  downloadHref,
}: {
  document: BlueprintDocument;
  downloadHref: string;
}) {
  const [atAGlance, planWorks, confirmations, nextSteps] = document.sections;
  return (
    <article className="blueprint-preview" aria-labelledby="blueprint-title">
      <header className="blueprint-cover">
        <div>
          <span className="blueprint-kicker">{document.report_type}</span>
          <h2 id="blueprint-title">{document.title}</h2>
          <p>{document.subtitle}</p>
        </div>
        <div className="blueprint-cover-meta">
          <span>{document.version_status}</span>
          <span>{document.date}</span>
          <span>{document.confidentiality_line}</span>
        </div>
      </header>

      <div className="blueprint-toolbar">
        <div>
          <strong>Your Blueprint is ready</strong>
          <span>Preview it here or keep a PDF copy.</span>
        </div>
        <a className="button button-primary" href={downloadHref}>
          Download PDF
        </a>
      </div>

      <section className="blueprint-section" aria-labelledby="at-a-glance-title">
        <span className="blueprint-section-number">01</span>
        <h3 id="at-a-glance-title">{atAGlance.title}</h3>
        {atAGlance.overview.map((paragraph) => (
          <p key={paragraph} className="blueprint-lede">{paragraph}</p>
        ))}
        <div className="blueprint-columns">
          <div className="blueprint-panel">
            <h4>Core objectives</h4>
            <ul>{atAGlance.objectives.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="blueprint-panel">
            <h4>Governing constraints</h4>
            <ul>{atAGlance.governing_constraints.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <dl className="blueprint-baseline">
          {atAGlance.planning_baseline.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="blueprint-schematic" aria-label="Estate Blueprint structure">
          {atAGlance.schematic.nodes.map((node, index) => (
            <div key={node} className="blueprint-schematic-step">
              <span>{node}</span>
              {index < atAGlance.schematic.nodes.length - 1 ? (
                <b aria-hidden="true">→</b>
              ) : null}
            </div>
          ))}
        </div>
        <ul className="blueprint-flow-notes">
          {atAGlance.schematic.flows.map((flow) => <li key={flow}>{flow}</li>)}
        </ul>
      </section>

      <section className="blueprint-section" aria-labelledby="plan-works-title">
        <span className="blueprint-section-number">02</span>
        <h3 id="plan-works-title">{planWorks.title}</h3>
        <div className="blueprint-component-grid">
          {planWorks.components.map((component) => (
            <article key={component.title} className="blueprint-component">
              <h4>{component.title}</h4>
              <dl>
                <div><dt>What it does</dt><dd>{component.what_it_does}</dd></div>
                <div><dt>Why it fits</dt><dd>{component.why_it_fits}</dd></div>
                <div><dt>Tradeoff or dependency</dt><dd>{component.tradeoff_or_dependency}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p className="blueprint-boundary">{planWorks.operating_detail_note}</p>
      </section>

      <section className="blueprint-section" aria-labelledby="confirmations-title">
        <span className="blueprint-section-number">03</span>
        <h3 id="confirmations-title">{confirmations.title}</h3>
        <div className="blueprint-confirmations">
          {confirmations.items.length ? confirmations.items.map((item) => (
            <article key={`${item.question}-${item.owner}`}>
              <h4>{item.question}</h4>
              <p>{item.why_it_matters}</p>
              <span>Owner: {item.owner}</span>
            </article>
          )) : <p>No material open confirmations remain.</p>}
        </div>
        <p className="blueprint-boundary">{confirmations.approval_boundary}</p>
        <p className="blueprint-boundary">{confirmations.existing_plan_boundary}</p>
      </section>

      <section className="blueprint-section" aria-labelledby="next-steps-title">
        <span className="blueprint-section-number">04</span>
        <h3 id="next-steps-title">{nextSteps.title}</h3>
        <ol className="blueprint-next-steps">
          {nextSteps.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="blueprint-columns">
          <div className="blueprint-panel">
            <h4>Decisions already made</h4>
            <ul>{nextSteps.decisions_already_made.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="blueprint-next-action">
            <span>Concrete next action</span>
            <strong>{nextSteps.concrete_next_action}</strong>
          </div>
        </div>
        {document.estate_team.length ? (
          <div className="blueprint-team">
            <h4>Your estate team</h4>
            {document.estate_team.map((member) => (
              <div key={`${member.name}-${member.role}`}>
                <strong>{member.name}</strong>
                <span>{member.role} · {member.firm_or_relationship}</span>
                <span>{member.contact}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="blueprint-advice-boundary">{document.advice_boundary}</p>
      </section>
    </article>
  );
}
