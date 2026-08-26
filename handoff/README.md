# Mirror Team Handoff

This project is organized to keep the current MVP source code distinct from handoff material for the wider product team.

| Folder | Audience | Purpose |
|---|---|---|
| `app/`, `components/`, `lib/` | Mobile/frontend team | Expo reference implementation for customer upload, requirements, recommendation, and virtual try-on UX. |
| `server/` | Backend engineer | Node.js REST service and AI orchestration source. |
| `database/` | Project manager and database owner | Proposed relational contract and Laravel mapping notes. |
| `handoff/frontend/` | Flutter developer | Endpoint integration sequence and DTO guidance. |
| `handoff/backend/` | Backend engineer | Production hardening plan, module boundaries, environment configuration, and API responsibilities. |
| `handoff/database/` | Project manager and database owner | Existing-database mapping checklist and ownership decisions. |
| `docs/` | All teams | REST contract, OpenAPI definition, and system diagrams. |

## Handoff Sequence

The Flutter developer can start from `handoff/frontend/FLUTTER_INTEGRATION.md` and `docs/openapi.yaml`. The backend engineer can use `handoff/backend/BACKEND_HANDOFF.md` to move the present Node MVP into the chosen production environment. The project manager should use `handoff/database/DATABASE_MAPPING.md` with the existing Laravel schema to decide the final foreign-key mapping and retention policy.

The working MVP intentionally keeps the web/mobile tester lightweight. The backend contract, validation rules, and response shapes are designed so the production Flutter application can call the Node service directly without reproducing the reference UI.
