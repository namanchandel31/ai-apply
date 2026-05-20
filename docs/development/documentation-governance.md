# Documentation governance

Prevent documentation from becoming a second stale codebase.

## When docs must update

Update docs in the **same PR** as code when you change:

| Change type | Update |
|-------------|--------|
| New migration | `database/schema.md`, `database/migrations.md` |
| API contract | `api/*`, `examples/request-payloads.md` |
| Env var add/remove | `environment.md`, `.env.example` |
| Queue/job ID pattern | `queues/deterministic-ids.md`, ADR if architectural |
| State machine / CAS | `architecture/state-model.md`, `backend/transactions-and-cas.md` |
| uiStatus rules | `frontend/ui-status-rendering.md` |
| Operational threshold | `observability/runtime-expectations.md` |
| Cross-cutting decision | New or superseded ADR |

## Source of truth

See [../architecture/source-of-truth-hierarchy.md](../architecture/source-of-truth-hierarchy.md): **code wins** unless docs mark behavior deprecated.

## ADR requirements

| Event | Action |
|-------|--------|
| New architectural choice | Add ADR as `proposed` → `accepted` when shipped |
| Reversal | Set old ADR `superseded`, link `Superseded-by` |
| Minor tweak | Update ADR body; keep status `accepted` |

Never delete ADRs.

## Stale-doc policy

1. If doc conflicts with code, fix doc or mark section **deprecated** with date.
2. Remove deprecated sections after one release cycle if unused.
3. Legacy redirect stubs at old paths remain until external links updated.

## PR expectations

- [ ] Behavior change reflected in relevant doc(s)
- [ ] Examples updated if serializer/API shape changed
- [ ] No references to removed env vars (`WORKER_MODE`, `DEBUG_ORCHESTRATION_*`, `SMTP_*`, `DEFAULT_AI_*`)
- [ ] `## Related Documentation` links on new deep pages

## Ownership

| Area | Default owner |
|------|----------------|
| Doc hub / glossary | Author of PR touching onboarding |
| ADRs | Engineer making architectural decision |
| Runbooks | On-call engineer after incident |
| API docs | Author of route change |

## Related Documentation

- [../adr/README.md](../adr/README.md)
- [../examples/README.md](../examples/README.md)
- [anti-patterns.md](anti-patterns.md)
