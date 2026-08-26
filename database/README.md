# Mirror AI Feature Database Proposal

This folder is intentionally separate from the Node API and frontend reference. It contains a **review artifact** for the team that owns the existing Laravel database. Do not run these files unchanged against production.

`mvp_schema.sql` models only the AI feature lifecycle: consultations, recommendations, asynchronous try-on work, output previews, and provider-attempt audits. It references the established Laravel tenant/customer/stylist/appointment IDs without replacing those core entities.

The database owner should decide whether the Node service receives a direct read/write connection to the Laravel database, a dedicated AI schema in the same cluster, or a separate database synchronized through Laravel events. For the MVP, a dedicated schema with external IDs and API-level tenancy checks is the least coupled option.
