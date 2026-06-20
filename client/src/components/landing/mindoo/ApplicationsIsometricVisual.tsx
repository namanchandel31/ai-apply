const ROWS = [
  {
    id: "stripe",
    role: "Senior Software Engineer",
    company: "Stripe",
    status: "Email Sent",
    statusColor: "green",
    match: "87%",
    updated: "20 Jun 2026, 9:40 AM",
  },
  {
    id: "notion",
    role: "Full Stack Engineer",
    company: "Notion",
    status: "Email Ready",
    statusColor: "blue",
    match: "72%",
    updated: "19 Jun 2026, 4:15 PM",
  },
  {
    id: "linear",
    role: "Backend Engineer",
    company: "Linear",
    status: "Email Sent",
    statusColor: "green",
    match: "91%",
    updated: "18 Jun 2026, 11:02 AM",
    popover: true,
  },
  {
    id: "figma",
    role: "Senior Frontend Engineer",
    company: "Figma",
    status: "Screening",
    statusColor: "yellow",
    match: "84%",
    updated: "17 Jun 2026, 2:30 PM",
  },
  {
    id: "ramp",
    role: "Staff Engineer, Payments",
    company: "Ramp",
    status: "Interviewing",
    statusColor: "orange",
    match: "79%",
    updated: "16 Jun 2026, 10:18 AM",
  },
] as const;

const STATUS_OPTIONS = [
  { label: "Email Ready", color: "blue" },
  { label: "Email Sent", color: "green", selected: true },
  { label: "Screening", color: "yellow" },
  { label: "Interviewing", color: "orange" },
  { label: "Offer", color: "purple" },
  { label: "Withdrawn", color: "brown" },
] as const;

function StatusDot({ color }: { color: string }) {
  return <span className={`m-iso-track-dot is-${color}`} aria-hidden />;
}

export function ApplicationsIsometricVisual() {
  return (
    <div className="m-iso-track" aria-hidden>
      <div className="m-iso-track-wrap">
        <div className="m-iso-track-panel">
          <div className="m-iso-track-table-wrap">
            <table className="m-iso-track-table">
              <thead>
                <tr>
                  <th className="is-check" />
                  <th>Role</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th className="is-num">Match</th>
                  <th className="is-date">Updated</th>
                  <th className="is-menu" />
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr
                    key={row.id}
                    className={"popover" in row && row.popover ? "is-active" : undefined}
                  >
                    <td className="is-check">
                      <span className="m-iso-track-checkbox" />
                    </td>
                    <td className="is-role">{row.role}</td>
                    <td className="is-company">{row.company}</td>
                    <td className="is-status">
                      <span className="m-iso-track-status">
                        <StatusDot color={row.statusColor} />
                        <span>{row.status}</span>
                      </span>
                    </td>
                    <td className="is-num">{row.match}</td>
                    <td className="is-date">{row.updated}</td>
                    <td className="is-menu">
                      <span className="m-iso-track-menu">···</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="m-iso-track-footer">
            <span>Showing 1–5 of 12 applications</span>
            <span className="m-iso-track-pages">20 / page</span>
          </div>
        </div>

        <div className="m-iso-track-popover">
          <div className="m-iso-track-popover-search">Search or create…</div>
          <ul className="m-iso-track-popover-list">
            {STATUS_OPTIONS.map((option) => (
              <li key={option.label}>
                <StatusDot color={option.color} />
                <span>{option.label}</span>
                {option.selected ? (
                  <span className="m-iso-track-popover-check" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="m-iso-track-popover-clear">Clear status</div>
        </div>
      </div>
    </div>
  );
}
