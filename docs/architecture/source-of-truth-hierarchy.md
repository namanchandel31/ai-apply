# Source-of-truth hierarchy

When sources disagree, use this precedence order (highest wins):

```txt
1. Code
2. Migrations
3. Tests
4. Docs
5. Diagrams
```

## Rules

| Rule | Detail |
|------|--------|
| **Implementation wins** | If docs conflict with running code, docs are wrong unless behavior is explicitly marked **deprecated** in docs with a timeline or superseding ADR |
| **Migrations define schema** | Table/column truth comes from `src/migrations/` |
| **Tests encode contracts** | Passing tests document expected behavior; update tests when intentionally changing contracts |
| **Diagrams are explanatory** | Mermaid charts are not authoritative; regenerate when code changes |
| **Examples follow serializers** | See [../examples/README.md](../examples/README.md) |

## Practical workflow

1. Read migration + model for schema questions.
2. Read service/worker for behavior.
3. Confirm with test if non-obvious.
4. Update docs in the **same PR** as behavior change when contracts change.

## Deprecated behavior

Document as:

```md
> **Deprecated:** Description. Removed in vX / superseded by ADR-00N.
```

Do not silently delete historical notes from ADRs — change ADR status to `superseded`.

## Related Documentation

- [../development/documentation-governance.md](../development/documentation-governance.md)
- [../adr/README.md](../adr/README.md)
