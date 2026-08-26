# Project Manager and Database Handoff

## Decision Required

The AI service should not become a second customer or appointment system. The existing Laravel database remains the source of truth for customer, salon, stylist, appointment, and service entities. This MVP database proposal stores only AI feature records and references existing IDs.

## Proposed Cross-System Mapping

| AI table field | Existing Laravel owner | Mapping decision |
|---|---|---|
| `tenant_id` | Salon/organization | Required for every stored portrait, result, job, and model audit row. |
| `customer_id` | Customer/user | Required for customer-owned consultations and saved looks. |
| `salon_id` | Salon | Optional direct index for reporting and access control. |
| `stylist_id` | Stylist | Optional; populate if a customer shares a chosen look for an appointment. |
| `appointment_id` | Appointment | Optional; populate only when a saved look is attached to a booked service. |
| `created_by_user_id` | Authenticated Laravel user | Required for administrative or stylist-initiated consultation flows. |

The product manager should confirm the exact existing table and primary-key names before migration. Do not create foreign keys across separate database servers until the ownership and deployment topology are final; application-level validation with durable IDs is often safer for the MVP.

## AI Data Retention Decisions

| Record | Recommended ownership | MVP policy decision required |
|---|---|---|
| Source portrait | Customer and tenant | Set a deletion window, such as 24–72 hours unless the customer explicitly saves it. |
| Analysis and recommendations | Customer | Keep only while a consultation is active, or retain with a saved look. |
| Generated preview | Customer | Retain only for saved looks; delete transient attempts quickly. |
| Model audit | Tenant/platform | Retain provider name, model, latency, status, and request ID; do not retain raw prompt text or image bytes in logs. |

The proposed SQL DDL is in `database/mvp_schema.sql`. It is a database-owner review artifact, not a migration to run automatically against the existing Laravel database.

