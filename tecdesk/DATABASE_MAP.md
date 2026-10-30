# Mapa de datos

```text
auth.users
   │ 1:1
   ▼
profiles (admin / technician)
   │
   ├──────────── assigned_to ───────────┐
   │                                    ▼
   │                                tickets
   │                                    │
   │              ┌─────────────────────┼──────────────────────┐
   │              ▼                     ▼                      ▼
   │       ticket_notes          ticket_worklogs       ticket_attachments
   │              │                     │                      │
   │              └────────────── ticket_id ───────────────────┘
   │                                    │
   │                                    ├──── ticket_status_history
   │                                    │
   │                                    └──── service_evaluations (1:1)
   │
   └──────────────────────────────────────── audit / author fields

report_summary() + technician_stats()
           │
           ├──── reports.html
           ├──── daily_report_snapshots
           └──── weekly-report Edge Function
```

## Tickets: ciclo de vida

`new → triage → assigned → in_progress → resolved → closed`

Estados auxiliares:

- `awaiting_user`
- `awaiting_parts`
- `cancelled`
