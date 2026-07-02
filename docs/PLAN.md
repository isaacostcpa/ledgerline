# Ledgerline — Product Plan & Build Roadmap

*A web-based, professional-grade trial balance & engagement platform for a CPA firm — from raw transactions or client-produced GL/TB all the way to a tax-software import file.*

**Owner:** Isaac Ost, CPA · **Last updated:** 2026-07-02

---

## 1. Vision

Ledgerline is the single workspace our firm uses to take **any** client's books —
raw transactions, a QuickBooks export, or a client-produced GL/TB — and drive them
through a disciplined, reviewable process to a finished product: professional
financial statements and an exact tax-software import file.

It should feel like the tools professional firms already pay for — **Thomson Reuters
AdvanceFlow / Workpapers CS**, **CCH ProSystem *fx* Engagement**, and **CaseWare
Working Papers** — but cloud-native, faster to learn, and tuned to *our* workflow and
*our* tax software (Drake).

**Design pillars:** web-based · visually attractive · easy to use · multi-user ·
audit-trailed · secure with client financial data.

---

## 2. Where we are today (honest assessment)

The repo already contains **Ledgerline v0** — a working single-file prototype
(`index.html`, ~2,300 lines) that proves the concept end-to-end.

- **Stack:** React 18 via in-browser Babel, Supabase (Postgres + Auth), SheetJS,
  PapaParse — all from CDNs, no build step.
- **Data model (Supabase):** `profiles`, `engagements`, `accounts`, `aje_headers`,
  `aje_lines`, `tax_mappings`, `classes`, `audit_log`.

### Coverage of the 11 requested capabilities

| # | Capability | Status | What exists | What's missing |
|---|---|---|---|---|
| 1 | TaxDome integration | ⛔ Not started | — | Blocked on TaxDome API; build connector when available |
| 2 | Multi-user mode | 🟡 Partial | Supabase Auth, admin/staff roles, invite, audit log | Firm/team scoping, Row-Level Security, granular permissions, review sign-off |
| 3 | Import any data set | 🟢 Strong | Universal CSV/Excel/GL/TB auto-detect, fuzzy columns, QB preamble, sub-accounts | Saved source templates, mapping memory, validation/reconciliation, PDF/OCR later |
| 4 | Standardize / manipulate CoA | 🟡 Partial | Accounts table, add account, type inference | Master CoA templates, groupings/subgroupings, standardization mapping, merge/renumber |
| 5 | Adjusting entries (reclass, book, tax) | 🟡 Partial | AJE headers/lines, post, audit | Entry-type tagging (AJE/RJE/book/tax), recurring, reversing, proposed vs posted, book↔tax columns |
| 6 | WP attachments & references | ⛔ Not started | Reference field on AJEs only | Workpaper binder, file storage, tickmarks, cross-references, leadsheets |
| 7 | Tax line mapping | 🟡 Partial | Drake line auto-suggest per entity type | Full Drake line libraries per form, grouping-driven mapping, M-1 items |
| 8 | Comprehensive Working TB | 🟢 Good | Unadjusted / adjusted / final, grouped by type | Multi-column (book · reclass · AJE · tax · final), leadsheet refs, grouping schedules |
| 9 | Year-to-year rollover | 🟡 Partial | Prior-year comparison load in statements | True binder rollover: carry CoA, mappings, groupings, workpapers; roll balances; create next FY |
| 10 | CPA-grade financial statements | 🟢 Good | Balance Sheet, P&L, Cash Flow, General Ledger, comparatives | Statement builder, notes, GAAP/cash basis, firm branding, PDF output |
| 11 | Drake tax template export | 🟡 Partial | `exportDrake` CSV + Beancount export | Exact Drake import spec per entity/form, validation, round-trip test |

**Takeaway:** roughly half the surface area already works. The plan is to **evolve
this foundation into a production product**, not rewrite it from scratch — while
graduating off the prototype stack so it's safe for real client data and multiple
concurrent users.

---

## 3. Architecture direction

The single-file CDN prototype is perfect for validating the workflow, but it is not a
safe home for real client financials or a growing team. We migrate deliberately:

| Layer | Prototype (today) | Production (target) | Why |
|---|---|---|---|
| Frontend | React via in-browser Babel, one HTML file | **Vite + React + TypeScript**, routed, component library | Type safety on money math, real build, testable, maintainable |
| Data / tables | TanStack Table + Query | Virtualized grids, server state, undo | TBs have thousands of accounts; needs speed |
| Backend | Supabase direct-from-browser | **Supabase** (Postgres + Auth + Storage + **RLS** + Edge Functions) | Keep the investment; RLS gives real multi-tenant isolation |
| Files | none | **Supabase Storage** buckets per firm/engagement | Workpaper attachments |
| Integrations | inline | Edge Functions (TaxDome, Drake, imports, PDF) | Secrets stay server-side |
| Auth | email/password | Email + **MFA**, SSO-ready, firm invites | Professional security posture |

**Multi-tenant hierarchy (enforced by RLS):**

```
Firm
 └─ Users (roles: admin · manager · staff · reviewer · read-only)
     └─ Clients
         └─ Engagements (fiscal year, entity type, basis)
             └─ Binder
                 ├─ Chart of Accounts (+ standardization/grouping)
                 ├─ Working Trial Balance (multi-column)
                 ├─ Adjusting Entries (AJE / RJE / book / tax)
                 ├─ Workpapers (files, leadsheets, tickmarks, refs)
                 ├─ Tax Line Mapping
                 └─ Financial Statements
```

---

## 4. Phased roadmap

Each phase is shippable and demoable on its own. Requirement numbers (from the brief)
are tagged so nothing is dropped.

### Phase 0 — Foundation & hardening
*Goal: safe, buildable, multi-tenant base.*
- Migrate prototype to Vite + React + TypeScript; preserve existing UI/logic.
- Full relational schema: `firms`, `clients`, `engagements`, `binders`, plus existing.
- Row-Level Security on every table; firm-scoped isolation; MFA.
- CI/CD, staging + production environments, automated Postgres backups.
- **Covers:** groundwork for #2.

### Phase 1 — Core Working Trial Balance engine  · #4 #8
- Master **Chart of Accounts** templates (industry/entity) + import mapping to standard.
- Account **groupings & subgroupings** (leadsheet structure), merge/renumber/reclassify.
- **Multi-column Working TB:** Unadjusted → Reclass → AJE → Adjusted → Tax → Final.
- Leadsheet references; grouping schedules; rounding & balancing checks.

### Phase 2 — Adjusting entries  · #5
- Entry **types:** AJE, Reclass (RJE), Book, Tax — filterable, colored, separately totaled.
- **Proposed vs posted** workflow; reviewer approval; **recurring** & **reversing** entries.
- Book-to-tax differences drive **Schedule M-1/M-3** items.
- Every entry balanced-enforced, fully audit-logged.

### Phase 3 — Workpapers & binder  · #6
- Engagement **binder** with folder tree; drag-drop **attachments** (Supabase Storage).
- **Leadsheets** auto-generated per grouping; **tickmarks**; **cross-references** between
  accounts, entries, and workpapers; review notes / sign-off.

### Phase 4 — Tax line mapping & Drake export  · #7 #11
- Complete **Drake tax-line libraries** per entity/form (1120, 1120-S, 1065, 1040-Sch C, 990…).
- Grouping-driven mapping (map a group once, inherit to accounts); M-1 mapping.
- **Exact Drake import template** generator with validation + a round-trip test harness.

### Phase 5 — Financial statements  · #10
- **Statement builder:** Balance Sheet, Income Statement, Cash Flow, Equity, Notes.
- GAAP / cash / tax basis; comparative periods; firm **branding**; export to **PDF & Excel**.

### Phase 6 — Rollover & binder lifecycle  · #9
- **Year-to-year rollover:** carry forward CoA, groupings, mappings, workpaper structure,
  recurring entries; roll ending → opening balances; create next fiscal-year binder.
- Binder **locking, archival, and PBC (prior-year) reference** views.

### Phase 7 — Integrations & multi-user polish  · #1 #2
- **TaxDome** connector (clients, engagements, documents) when their API ships.
- **QuickBooks Online** import (available now via connector) as a first-class source.
- Granular permissions, real-time presence, notifications, activity feed, full RBAC.

---

## 5. Security & compliance (non-negotiable — this is client financial data)

- Row-Level Security isolating every firm's data at the database.
- Encryption in transit (TLS) and at rest; secrets only in Edge Functions.
- MFA; least-privilege roles; complete, immutable audit trail (already seeded).
- Automated backups + point-in-time recovery; documented retention policy.
- Path toward **SOC 2** posture; access reviews; per-engagement locking after filing.

---

## 6. Reference products we're learning from

- **Thomson Reuters AdvanceFlow / Workpapers CS** — closest cloud analog; binder + WTB model.
- **CCH ProSystem *fx* Engagement** — groupings, tax grouping codes, leadsheets.
- **CaseWare Working Papers** — document management, tickmarks, rollovers.

We clone the *proven workflow*, not the software — and deliver it cloud-native and tuned to Drake.

---

## 7. Immediate next steps (proposed)

1. Confirm the architecture direction (migrate prototype → Vite/TS on Supabase). ← decision needed
2. Stand up Phase 0: schema + RLS + build pipeline, porting the working UI across.
3. Ship Phase 1 (multi-column WTB + CoA standardization) as the first production milestone.

*Open dependency: TaxDome API availability gates Phase 7's TaxDome connector; everything else can proceed now.*
