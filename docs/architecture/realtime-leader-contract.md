# Leader / follower contract

| Capability | Leader | Follower |
|------------|--------|----------|
| Own SSE transport | YES | NEVER |
| `transport.connect()` | YES | NEVER |
| `GET /api/orchestration/active` | YES (bootstrap / Tier 3) | NEVER |
| Replay / convergence heal | YES | NEVER |
| `BroadcastChannel.post` state | YES (`state_patch`) | NEVER |
| Receive `state_patch` | YES | YES (mirror) |
| User HTTP actions (retry/send) | YES | YES |

Runtime: `assertLeaderOnly()` logs `LEADER_OWNERSHIP_VIOLATION` and no-ops when not leader.

Broadcast direction: leader → follower only for realtime state patches.
