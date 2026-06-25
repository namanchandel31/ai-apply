# Graph Report - extension  (2026-06-26)

## Corpus Check
- 10 files · ~14,985 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 164 nodes · 288 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6e916b36`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 12 edges
2. `injectButton()` - 11 edges
3. `init()` - 9 edges
4. `refreshLinkedInBanner()` - 8 edges
5. `render()` - 8 edges
6. `bgRequest()` - 7 edges
7. `refreshPopupStatus()` - 7 edges
8. `fetchPopupStatus()` - 6 edges
9. `isExtensionContextValid()` - 6 edges
10. `queryActionCandidates()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `refreshLinkedInBanner()` --calls--> `setupIssuesFromStatus()`  [INFERRED]
  src/content/linkedin/main.js → src/shared/applyModeCopy.js
- `createStandaloneButton()` --calls--> `linkedInButtonTitle()`  [INFERRED]
  src/content/linkedin/main.js → src/shared/applyModeCopy.js
- `getSetupStatus()` --calls--> `isSetupCompleteFromStatus()`  [INFERRED]
  src/content/linkedin/main.js → src/shared/applyModeCopy.js
- `isSetupComplete()` --calls--> `isSetupCompleteFromStatus()`  [INFERRED]
  src/content/linkedin/main.js → src/shared/applyModeCopy.js
- `updateButtonIdleState()` --calls--> `linkedInButtonTitle()`  [INFERRED]
  src/content/linkedin/main.js → src/shared/applyModeCopy.js

## Import Cycles
- None detected.

## Communities (10 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (35): buttonIconHtml(), collectPostRoots(), controlHints(), countDistinctEmails(), countSocialButtons(), createInlineActionItem(), createStandaloneButton(), ensureStyles() (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (27): apiFetch(), AUTH_STORAGE_KEYS, clearAuthStorage(), exchangeConnectToken(), fetchApplyMode(), fetchDetectionConfig(), fetchPopupStatus(), fetchPopupStatusFromApi() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (24): ENVIRONMENTS, applyPopupStatus(), autoToggleBtn, bgRequest(), closePanelBtn, connectedContentEl, connectExtensionBtn, connectionStatusEl (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (25): action, default_icon, default_title, background, service_worker, type, content_scripts, 128 (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (15): bgRequest(), getCachedConfig(), getSetupStatus(), importExtensionModule(), init(), isConnected(), isContextInvalidatedError(), isExtensionContextValid() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (11): 1. Supabase (for token refresh), 1b. Environment (dev vs production), 2. Website connect, Auth (Phase 0.5b), Configuration, Features, LinkedIn button, OneTap Chrome Extension (MVP) (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (3): updateButtonIdleState(), autoApplyToggleDescription(), linkedInButtonTitle()

### Community 7 - "Community 7"
Cohesion: 0.50
Nodes (3): createPanelController(), getPanelController(), POPUP_URL

## Knowledge Gaps
- **44 isolated node(s):** `manifest_version`, `name`, `version`, `description`, `permissions` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isAutoApplyMode()` connect `Community 0` to `Community 2`, `Community 6`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `refreshButtonApplyModeHints()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `refreshLinkedInBanner()` (e.g. with `isSetupCompleteFromStatus()` and `setupIssuesFromStatus()`) actually correct?**
  _`refreshLinkedInBanner()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `manifest_version`, `name`, `version` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14532019704433496 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12535612535612536 - nodes in this community are weakly interconnected._