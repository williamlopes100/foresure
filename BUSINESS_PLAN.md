# Foreclosure Management Platform — Business Plan

## Overview

A web-based foreclosure document automation platform (**foreclo.ai**) built for **Ben Wyse**, a Texas attorney whose primary practice is **nonjudicial foreclosures** and **estate planning**. The platform automates the most time-consuming part of his workflow: extracting data from funding packages, recorded deeds of trust, and title searches, generating a **"File Abstract"** (formerly called "Legal Description" sheet), and then using that sheet to auto-populate all downstream foreclosure notices and documents.

> **App Name:** foreclo.ai (alternative: foreclosure.ai if domain available)

**Client:** Bennett M. Wyse, Attorney at Law — Pratt Aycock, Ltd. (bwyse@prattaycock.com)
**Developer:** Will Lopes (Will Fixit Solutions, Mt Pleasant) (mtpleasant@willfixitsolutions.com)
**State:** Texas (nonjudicial foreclosure state — attorney forecloses without court involvement)
**Office:** 5910 N Central Expy, Suite 920, Dallas, TX 75206 | Direct: 469-807-3043 | Alt: 214-473-5551

## Key Players

- **Ben Wyse** — Foreclosure attorney (primary user)
- **Brent Conrad** — Owner of Conrad Properties (client, ~70% of Ben's business)
- **Neal Stewart** — Runs Conrad Properties day-to-day (main contact who sends intake docs)
- **Ted Gambordella** — Associate attorney in Dallas doing 50+ foreclosures/month (potential future user — 10x volume potential)
- **CR Lending, LLC** — The lending entity
- **Conrad Properties, LLC** — Loan servicer

## The Problem

Ben currently spends hours per foreclosure manually:
1. Reading through funding packages and recorded deeds of trust
2. Extracting key data points (grantor names, addresses, EINs, etc.)
3. Filling out a "legal description" sheet with all extracted data
4. Copy-pasting from the legal description into multiple notice templates and documents
5. Reviewing everything for errors (and still missing things like "sister" vs "sister-in-law")

He wants to **double, triple, or quadruple** his foreclosure volume. Currently does ~5/month. AI automation is the bottleneck breaker.

### Ben's Time Breakdown (from email confirmation)
- **1.5 hours** — Just for initial intake and opening the file on: Clio, Outlook, Local Windows folders, and Paper folder
- **2-3 hours** — Creating the produced documents for the foreclosure process (this is most of his billable time)
- **Total: 3.5-4.5 hours per file** — This is what we're automating

## Ben's Current Manual Workflow (5 Steps)

1. **Receive & Review** — Client email from Neal Stewart with intake docs
2. **Create 3 folders:**
   - Outlook folder
   - Local Windows folder
   - Clio folder (case management)
3. **Import client docs** into all 3 folders
4. **Print docs** to physical paper folder
5. **Create "Legal Description"** document (really a file abstract/summary)

### Outlook Folder Naming Convention

```
CONRAD-[Address#] [Street] [Status] [Clio#] (Initials) - Fc #[Attempt]
```

**Example:** `CONRAD-901 W. 7TH [O] [2026-00001] (BMW) - Fc #1`

**Status codes:**
- `O` = Open
- `C` = Closed
- `C+B+U` = Closed, Billed, Unpaid
- `C+B+P` = Closed, Billed, Paid
- `P` = Pending (if in Bankruptcy or such)

### CLIO Number Format
- Insert a **hard hyphen after the 4th digit** (e.g., `2026-00001`)
- Display with **right justification** on the legal description sheet

## The Two-Step Process

### Step 1: Documents → File Abstract (3-Phase Intake)

The document formerly called "Legal Description" is now called **"File Abstract"** to avoid confusion with the actual legal description of the property.

The AI reads uploaded PDFs natively (Claude PDF vision) and extracts all relevant fields into a structured **File Abstract**.

#### Phase 1: Initial File Setup
Upload **three documents** together:
1. **Funding Package** — Main bundle from the lender (contains unrecorded DOT, note, borrower ID, etc.)
2. **Recorded Deed of Trust** — The recorded copy (has instrument number, recording date)
3. **ServiceLink Substitute Trustee List** — County-specific trustees, sale hours, sale location

> **Key insight from Ben:** The funding package contains the deed of trust BEFORE it was recorded. The recorded copy comes later and has the instrument/recording numbers. Both are needed.

#### Phase 2: Title Search Supplement (~1 month later)
Upload the **title search report** from Ameristar. This may reveal:
- Assignments of DOT not from the original client
- Releases of lien
- Other recorded instruments

The AI **patches/overlays** new data onto the existing File Abstract — where conflicts exist, newer data wins.

#### Phase 3: Zombie File Reopen (months/years later)
Foreclosure files are "zombie files" — they come back to life. A file may go dormant for 8+ months, then reopen for another foreclosure attempt. On reopen, upload:
- **Updated ServiceLink list** (trustees may have changed)
- **Updated title search** (covers the gap period only)

The AI merges new data into the existing File Abstract without starting from scratch.

> **Ben's preference:** "I would not want to, after an eight month period, start from scratch as if there had never been a foreclosure."

**Complete template fields (from `Legal Description 901 7th (3).docx` — to be renamed `File Abstract`):**

### Section 1: Header & Grantor Info

| Field | Description | Repeats |
|---|---|---|
| `{FILE NAME}` | Property/case name (e.g., "901 7th") | 1x |
| `{CLIO-NUMBER}` | Clio case ID, right-justified, hyphen after 4th digit | 1x |
| `{COMMON-ADDRESS}` | Full commonly known property address (911 address) | 4x |
| `{GRANTOR-NAME}` | Full legal grantor name (with LLC type or individual) | ~12x |
| `{GRANTOR-REP}` | Grantor representative (care of person) | ~6x |
| `{GRANTOR-REP-TITLE}` | Representative's title/role | ~6x |

### Section 2: Identification

| Field | Description | Visibility |
|---|---|---|
| `{EIN}` | Employer Identification Number | Always |
| `{DL#}` | Driver's license number | Always |
| `{DOB}` | Date of birth | Always |
| `{SSN}` | Social Security Number | Always |
| `{PASSPORT#}` | US Passport number | **Only if applicable** |

### Section 3: Mailing Addresses (up to 4)

| Field | Description |
|---|---|
| `{GRANTOR-ADDRESS1}` | First mailing address |
| `{GRANTOR-ADDRESS2}` | Second mailing address |
| `{GRANTOR-ADDRESS3}` | Third mailing address |
| `{GRANTOR-ADDRESS4}` | Fourth mailing address (visibility rule) |

Each mailing block follows this pattern:
```
Via Certified Mail _
and via First Class U.S. Mail
{GRANTOR-NAME}
c/o {GRANTOR-REP} {GRANTOR-REP-TITLE}
{GRANTOR-ADDRESS1}
```

### Section 4: Parties

| Field | Description |
|---|---|
| `{ORIGINAL-GRANTEE-NAME}` | Original lender/beneficiary |
| `{CURRENT-GRANTEE-NAME}` | Current lender/beneficiary |
| `{SERVICING AGENT}` | Loan servicing company (+ "a Texas Limited Liability Company") |
| `{TRUSTEE}` | Original trustee named in the DOT |
| `{LOAN SERVICER}` / `{LOAN-SERVICER}` | Loan servicer (+ "a Texas Limited Liability Company") |

### Section 5: Legal Description (Split Logic — CRITICAL)

| Field | Description |
|---|---|
| `{LEGAL-DESCRIPTION-RECORDING}` | Recording info paragraph (county, survey, abstract, prior deeds) |
| `{LEGAL-DESCRIPTION-METES}` | Metes and bounds calls (goes in **EXHIBIT "A"**) |
| `{COMMON-ADDRESS}` | Street address appended at end |

#### Two Types of Legal Descriptions (from Ben's training, Feb 10 call)

**Type 1: Metes and Bounds (outside city limits)**
The full legal description has TWO parts that must be split:

1. **Recording Information Paragraph** — Starts with "SITUATED IN [COUNTY] COUNTY, TEXAS..." and contains:
   - County name
   - Survey and abstract number
   - Prior tract conveyance info (volume, page, deed records)
   - Ends with "...said part being described more particularly as follows:"
   
2. **Metes and Bounds Calls** — Starts with "BEGINNING AT..." and contains:
   - Iron rod/corner descriptions
   - Directional bearings and distances
   - Ends with "...CONTAINING [X] ACRES OF LAND."

**AI must split these two parts:**
- Part 1 (recording info) → goes in the **Property/Legal Description** section of the File Abstract
- Replace "more particularly as follows" with "being more particularly described by metes and bounds in the attached Exhibit 'A'"
- Part 2 (metes & bounds) → goes in **EXHIBIT "A"**
- Append: `and more commonly known as {COMMON-ADDRESS}`

> **Ben's rule:** "If it's only one paragraph of metes and bounds, I don't NEED an exhibit A — it could fit inline. But for longer ones, always split."

**Type 2: Subdivision/Lot-Block (inside city limits)**
Short description showing block number, lot number, subdivision name, city, and county. These are short enough to stay inline — no Exhibit A needed.

> **Ben's explanation:** "If it's within the city limits, it'll be in a subdivision showing block and lot number in the plat records of the city and county."

### Section 6: Deed of Trust (DOT)

| Field | Description |
|---|---|
| `{DOT-INSRUMENT#}` | DOT instrument/recording number |
| `{DOT-EFF-DATE}` | DOT date signed |
| `{DOT-R-DATE}` | DOT date recorded |
| `{COUNTY}` | County where property is located |

### Section 7: Assignments of DOT (up to 2) — Assignment Chain Logic

| Field | Description |
|---|---|
| `{AODOT1-INSTRUMENT#}` | First assignment instrument number |
| `{AODOT1-EFF-DATE}` | First assignment effective date |
| `{AODOT1-R-DATE}` | First assignment recording date |
| `{AODOT2-INSTRUMENT#}` | Second assignment instrument number |
| `{AODOT2-EFF-DATE}` | Second assignment effective date |
| `{AODOT2-R-DATE}` | Second assignment recording date |
| `{AODOT-GRANTOR}` | Grantor on the assignment |
| `{AODOT-GRANTEE}` | Grantee on the assignment |

#### Assignment Chain Rules (from Ben's training, Feb 10 call)

The AI must understand the **lien assignment chain**:

1. **We always have a Deed of Trust** — this is the base document
2. **Assignment of DOT** = transferring the lien from one lender/beneficiary to another
   - Can be called: "Assignment of Deed of Trust", "Assignment of Lien", or "Assignment of Contract"
   - All are functionally the same — they assign the lien
3. **Second Assignment / Reassignment** — May reassign back to the original lender, or to a third party
   - Can be called: "Reassignment of Deed of Trust" or just another "Assignment of Deed of Trust"
4. **Release of Lien** — Sometimes used instead of a reassignment
   - If a Release of Lien is filed, the assignment goes away and the lien falls back to the original lender under the DOT
   - "That's not a good way to do it, but they may still just do it" — Ben

> **CRITICAL: Assignment of Rents ≠ Assignment of Lien**
> An Assignment of Rents (AOR) only assigns the right to collect rental payments. It does NOT assign the lien and does NOT change who can foreclose. The AI should note it but NOT treat it as part of the lien chain.

**Where these documents are found:**
- **Recorded DOT, Assignments, Releases** → Found in the **title search** (recorded documents)
- **Promissory Note** → Found in the **funding package** (never recorded)
- **Both** are needed for a complete File Abstract

### Section 8: Releases of Lien (up to 2)

| Field | Description |
|---|---|
| `{ROL1-INSTRUMENT#}` | First release instrument number |
| `{ROL1-EFF-DATE}` | First release effective date |
| `{ROL1-R-DATE}` | First release recording date |
| `{ROL2-INSTRUMENT#}` | Second release instrument number |
| `{ROL2-EFF-DATE}` | Second release effective date |
| `{ROL2-R-DATE}` | Second release recording date |

### Section 9: Promissory Note

| Field | Description |
|---|---|
| `{NOTE-DATE}` | Date of the promissory note |
| `{NOTE-AMOUNT}` | Original principal amount |
| `{NOTE-MATURITY-DATE}` | Maturity date of the note |

### Section 10: Substitute Trustees & Sale (from ServiceLink)

| Field | Description | Source |
|---|---|---|
| `{SVCLINK-SUB-TRUSTEES}` | Additional substitute trustees (after Ben + Ted) | ServiceLink PDF, column 3 ("Trustees") |
| `{COUNTY}` | County for the sale | Legal description / DOT |
| `{COUNTY-SEAT}` | County seat city (e.g., Dallas for Dallas County) | ServiceLink PDF |
| `{HOURS OF SALES}` | Hours during which the sale occurs | ServiceLink PDF |
| `{LOCATION OF SALES}` | Designated area for the foreclosure sale | ServiceLink PDF |
| `{SVCLINK-DATE}` | Date of the ServiceLink list (bottom-left of each page) | ServiceLink PDF |

**Substitute Trustees list always starts with:**
1. Bennett M. Wyse
2. Ted Gambordella
3. Then county-specific trustees from ServiceLink ("primary listed first")

**ServiceLink PDF structure (12 pages, alphabetical by county):**
- Column 1: County name
- Column 2: Sale hours
- Column 3: Trustees (primary listed first)
- Column 4: County seat
- Column 5: Location for sale
- Footer (bottom-left): Date updated (e.g., "12/12/2025")

> **Ben's note on Leslie Schueller:** ServiceLink recently added her to Dallas County trustees — the list changes every 2-3 months.

### Section 11: EXHIBIT "A"

| Field | Description |
|---|---|
| `{LEGAL-DESCRIPTION}` | Full legal description including metes and bounds |

**Important rules:**
- Placeholders use **curly braces**, **capitalized**, **hyphenated** e.g., `{GRANTOR-NAME}`
- `{GRANTOR-NAME}` repeats ~12 times throughout — changing it once updates all instances
- Borrower = `{GRANTOR-NAME}` — no separate borrower field
- **LLC info on mailing addresses:** Delete LLC from all mailing addresses — only on the GRANTOR line
- **Mailing addresses:** Must be single-spaced; each sent via Certified Mail AND First Class U.S. Mail
- **`{PASSPORT#}`:** Visibility rule — show **ONLY IF APPLICABLE**
- **"as to an undivided 100% interest":** Redundant hard term — delete
- **Servicing Agent LLC:** Redundant soft/insertable term — delete
- Legal description is **split**: abbreviated in main body + full in **EXHIBIT "A"** (metes and bounds)
- **`{COMMON-ADDRESS}`** inserted at the end of every LEGAL DESCRIPTION block
- Named substitute trustees always include: **Bennett M. Wyse, Ted Gambordella** + county-specific trustees from ASAP ServiceLink
- Foreclosure sale location comes from the ASAP ServiceLink list for the property's county
- Template footer: `/bmw (01/14/26)` — Ben's initials + date

### Step 2: File Abstract → Document Generation

Once the File Abstract is populated, the system uses it to auto-generate all downstream foreclosure documents:
- Notices (Notice of Default, Notice of Sale, etc.)
- Letters to borrowers
- Envelopes with correct mailing addresses
- Filing documents

The File Abstract is the **single source of truth** — all documents pull from it. This eliminates copy-paste errors.

**Ben's key insight:** "Once we have the [file abstract], it's all there for all of my document creation from that point on."

**File Abstract formatting rules (from Ben's feedback):**
1. CLIO Number moves to top line, right-justified
2. Legal description split: recording info in main section, metes & bounds in EXHIBIT "A"
3. **Commonly known address** inserted at the end of the legal description
4. Assignment chain must be understood (AODOT vs AOR vs ROL)
5. **ASAP ServiceLink list** of Substitute Trustees for each county must be insertable (updated every 2-3 months)
6. The **place of the Fc Sale** comes from the ASAP ServiceLink list
7. **ServiceLink date** tracked for 90-day reminder to update

**Ben's reaction to first automation test (Jan 2026):** "This is terrific! ... Anyway, even as it is, it would save a lot of time! We're on our way!"

**Ben's reaction to second test (Feb 10, 2026):** "Actually did a great job on all the particulars... this is a complicated lender with three different lenders with strange different percentages of ownership."

## Document Categories

| Doc Type | Abbreviation | Priority | Frequency |
|---|---|---|---|
| Funding Package | PKG | **Major** | Always |
| Recorded Deed of Trust | DOTR | **Major** | Always |
| Assignment of DOT | AODOT-R | **Major** | Sometimes |
| Release of Lien | ROL-R | **Major** | Sometimes |
| Assignment of Rents | AOR-R | Minor | Always |
| Property Tax Statement | — | Minor | Sometimes |
| Beneficiary Demand for Payoff | BDFP | Minor | Always (fluctuates) |
| Loan Running Calc/Arrears | LRC | Minor | Always (fluctuates) |

## Real Sample Files (from 17838 FM 451 / Conrad case)

These are the actual documents in a typical foreclosure file:

| File | Description |
|---|---|
| `Funding Pkg - 17838 FM 455.pdf` (22MB) | The main funding package from the lender |
| `DOT _ Recorded.pdf` (687KB) | Recorded Deed of Trust |
| `FM455 Celina - Executed Allonge and AODOT(1).pdf` (1.7MB) | Assignment of Deed of Trust + Allonge |
| `17838 FM 451 - #1 - Payoff 2126.pdf` | Payoff statement (set 1) |
| `17838 FM 451 - #2 - Payoff 2126.pdf` | Payoff statement (set 2) |
| `17838 FM 451 - #3 - Payoff 2126.pdf` | Payoff statement (set 3) |
| `BSOA 1.pdf` / `BSOA 2.pdf` / `BSOA 3.pdf` | Borrower Statement of Account |
| `Loan Master Report 1-3.pdf` | Loan master reports |
| `Loan Reinstatement Calculation 1-3.pdf` | Reinstatement calculations |
| `Copy of ServiceLink ASAP_ ASAP SubTrustee List_ December 2025.pdf` | ASAP ServiceLink Substitute Trustee list by county |

**Intake email format:** `CONRAD-17838 FM 455 [2026-11019] (Fc #1) - Start Fc Process.eml`

## Texas Nonjudicial Foreclosure Context

- Texas is a **self-help state** — attorneys foreclose without judicial involvement
- Foreclosure sales happen **one day per month** (first Tuesday)
- Notices must be sent **21 days before** the sale (~10th-11th of the month)
- A foreclosure can be **reposted** month after month (only the sale date changes)
- Each foreclosure is tracked by **property address** (e.g., "1313 Mockingbird Lane")
- Ben uses **Clio** as his legal case management software (separate from this app)
- **ASAP ServiceLink** provides the list of Substitute Trustees per county (updated every 2-3 months)
- The **place of the foreclosure sale** is determined by the ASAP ServiceLink list for the property's county

## Business Context (Hard Money Lending)

- These are **hard money loans** (6-month terms, high fees)
- **Extension fees** = 1% per 3 months
- **Late fees** compound quickly
- Borrowers often can't catch up → foreclosure
- This is why there's a steady pipeline of foreclosure work

## Pricing Model (Agreed with Ben)

| Item | Amount |
|---|---|
| **Base monthly fee** | ~$399/month |
| **Per foreclosure fee** | $50 per foreclosure set (whether it sells or not) |
| **Hosting cost (VPS)** | ~$119/month (private server for attorney confidentiality) |
| **Database cost** | ~$25/month |
| **API costs (Claude, etc.)** | Fractions of cents per use, typically <$100/month total |

**Minimum monthly commitment:** $543/month (base + hosting + DB + API) — confirmed by Ben on Feb 10 call. "That means I've gotta really produce or I'm in big trouble because that's a lot of money."

**Example month:** 5 foreclosures = $399 base + $250 (5 x $50) = $649/month revenue

**Revenue share for resale:** Ben gets **20%** of revenue from any other law firms that use the platform (since he's the beta tester and domain expert). Ben's wife specifically asked about this.

**Confidentiality requirement:** Must run on a **VPS (Virtual Private Server)** — not shared hosting. Attorneys have a professional duty to protect client information. Breach = disbarment risk.

**Billing starts:** When the app is up and running. Will has been paying hosting costs since late December 2025 / early January 2026.

## Scaling Plan

- **Phase 1:** Build for Ben (Texas nonjudicial foreclosures)
- **Phase 2:** Sell to other Texas foreclosure law firms ($100/foreclosure for larger firms)
- **Phase 3:** Adapt for South Carolina (judicial foreclosure — more complex, more revenue per case)
- **Phase 4:** Add estate planning workflow (wills — mirror document generation for husband/wife)
- **Phase 5:** Add lawsuit forms workflow

**Ben's projection:** A firm doing 50 foreclosures/month = $5,000+/month revenue from one client alone. 50 law firms = massive passive income.

## Additional Workflows (Future)

### Estate Planning (Wills)
- Ben's second biggest practice area
- Key pain point: Creating a husband's will, then "mirroring" it for the wife (husband→wife, wife→husband, sister→sister-in-law, etc.)
- Currently takes hours and still produces errors
- AI could do this "with the push of a button"

### Lawsuit Forms
- Third practice area
- Repetitive forms that could be templated

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **UI Components:** Untitled UI (React component library)
- **Routing:** React Router v7
- **Animations:** Motion (Framer Motion)
- **Icons:** @untitledui/icons, @untitledui/file-icons
- **PDF Reading:** Claude native PDF vision (sends PDFs directly to Anthropic API as document blocks)
- **PDF Splitting:** pdf-lib (splits large PDFs into 10-page chunks for token limits)
- **DOCX Generation:** docxtemplater + pizzip
- **Backend:** Express.js on port 3001, tsx runner (Node v24 ESM)
- **Hosting:** VPS (dedicated, not shared — attorney confidentiality requirement)
- **Database:** Supabase PostgreSQL (~$25/month budget)

## Application Structure

### Pages

1. **Login Page** (`/`) — User authentication via `LoginCardSeparated` component
2. **Dashboard** (`/dashboard`) — Landing page after login showing welcome state and "Start Foreclosure" CTA
3. **Foreclosure Form** (`/foreclosure-form`) — Multi-step form for submitting foreclosure packets
4. **Not Found** (`/*`) — 404 page

### Authentication

- Login is handled via a custom `LoginCardSeparated` component
- Auth state managed through a `useAuth` hook
- User info: William Lopes (williamlopes100@icloud.com)

### Navigation

- Header navigation bar with avatar dropdown
- Avatar dropdown shows user photo, name, email, and sign out option
- No sidebar navigation currently — header-only layout

## Current Multi-Step Form (3 Steps)

**Step 1 — Upload Packet ("Drop your packet here like it's hot")**
- Drag & drop file upload zone using Untitled UI FileUpload component
- Supports PDF, DOC, DOCX (max 10MB)
- Multiple file uploads with individual progress bars
- Real-time upload progress tracking
- Retry failed uploads, delete files
- User uploads: funding package + recorded deed of trust

**Step 2 — Review Packet**
- Lists all uploaded files with sizes and status
- Shows detected packet contents (Mortgage Statement, Property Deed, Notice of Default)
- Flags missing documents with warnings
- (Future: AI-extracted fields preview for user to verify before generating legal description)

**Step 3 — Confirmation**
- Success message with reference ID
- Submission details (date, status)
- File count summary
- "View Dashboard" button to return

## Roadmap

### Done
- [x] **Authentication system** — Email/password login
- [x] **File Abstract template engine** — Upload PDFs → Claude extracts fields → review → generate DOCX
- [x] **Claude PDF vision integration** — Native PDF reading (no OCR needed)
- [x] **PDF chunking for large files** — pdf-lib splits 50+ page funding packages into 10-page chunks
- [x] **Field extraction AI prompt** — Trained on Ben's call transcripts + template structure
- [x] **DOCX generation** — docxtemplater fills File Abstract template with extracted fields
- [x] **Review/edit step** — User can review and edit all extracted fields before generating DOCX

### In Progress
- [ ] **Legal description splitting** — Auto-split recording info vs metes & bounds into Property section vs Exhibit A
- [ ] **ServiceLink integration** — Extract trustees, sale hours, sale location, county seat from ServiceLink PDF
- [ ] **Rename "Legal Description" → "File Abstract"** throughout codebase and template

### Next Up
- [ ] **3-phase document intake** — Phase 1 (funding pkg + DOT + ServiceLink), Phase 2 (title search), Phase 3 (zombie reopen)
- [ ] **Patch/overlay capability** — New docs merge into existing File Abstract, newer data wins on conflicts
- [ ] **Case management dashboard** — Table view of all foreclosures by property address, sortable by date/county/grantor
- [ ] **ServiceLink settings page** — Upload/replace ServiceLink PDF with 90-day expiry reminder banner
- [ ] **Driver's license / DOB extraction** — Read scanned ID images from funding package page 1

### Future
- [ ] **Document generation engine** — File Abstract → auto-populate notices, letters, envelopes
- [ ] **Reposting workflow** — One-click repost for next month (only changes sale date)
- [ ] **Per-foreclosure billing** — Charge $50 per completed foreclosure set
- [ ] **Time tracking dashboard** — Show Ben how much time he saves per foreclosure
- [ ] **Multi-address support** — Dynamic address fields with visibility rules
- [ ] **Estate planning module** — Will generation with husband/wife mirroring ("should actually be pretty easy" — Ben)
- [ ] **Lawsuit forms module** — Templated lawsuit document generation
- [ ] **Multi-tenant support** — Sell to other Texas law firms
- [ ] **South Carolina judicial foreclosure module** — Adapt for judicial states
- [ ] **Stripe integration** — Automated billing (base + per-foreclosure)
- [ ] **Clio integration** — Sync with Ben's existing legal software

## Design System

- Uses **Untitled UI** component library throughout
- Color theme defined in `src/styles/theme.css` with CSS custom properties
- Brand colors based on gray-blue palette
- Supports light mode (dark mode tokens available)
- Typography: Inter font family
- Components: Buttons, Avatars, Dropdowns, File Upload, Empty States, Progress Bars, Badges, etc.

## File Structure

```
src/
├── components/          # UI components (Untitled UI based)
│   ├── application/     # App-level components (navigation, file upload, empty states)
│   ├── base/            # Base components (buttons, inputs, avatars, dropdowns)
│   ├── foundations/      # Design tokens, icons, logos
│   ├── marketing/       # Marketing page components
│   └── shared-assets/   # Shared components (login forms)
├── hooks/               # Custom React hooks (useAuth, useBreakpoint, useClipboard)
├── pages/               # Page components
│   ├── dashboard-page.tsx
│   ├── foreclosure-form.tsx
│   └── not-found.tsx
├── providers/           # Context providers (theme, router)
├── styles/              # Global styles and theme CSS variables
├── types/               # TypeScript type definitions
├── utils/               # Utility functions (cx for classnames)
└── main.tsx             # App entry point with routing
```

## Key Business Terms

- **Funding Package (PKG)** — Bundle of documents from the lender sent to the attorney to initiate foreclosure
- **Recorded Deed of Trust (DOTR)** — The recorded mortgage document showing borrower, lender, property, and terms
- **Assignment of DOT (AODOT-R)** — Document transferring the deed of trust to another party
- **Release of Lien (ROL-R)** — Document releasing a lien on the property
- **Assignment of Rents (AOR-R)** — Document assigning rental income rights (**does NOT assign the lien — ignore for foreclosure chain**)
- **Allonge** — A separate sheet attached to a promissory note for additional endorsements
- **BSOA** — Borrower Statement of Account
- **BDFP** — Beneficiary Demand for Payoff
- **LRC** — Loan Running Calc / Arrears calculation
- **File Abstract** (formerly "Legal Description Sheet") — Ben's master data sheet for each foreclosure — contains all extracted fields used to generate every downstream document
- **Exhibit "A"** — Full legal description including metes and bounds (attached to notices)
- **Metes and Bounds** — A system of describing land by directions and distances ("calls")
- **Grantor** — The borrower / property owner in the deed of trust
- **Grantor Rep** — The representative of the grantor entity (care of person)
- **Commonly Known Address** — The street address of the property (vs. the legal lot/block description)
- **NOD (Notice of Default)** — Legal notice that a borrower is behind on payments
- **NOS (Notice of Sale)** — Legal notice of upcoming foreclosure auction
- **Nonjudicial Foreclosure** — Foreclosure without court involvement (Texas)
- **Judicial Foreclosure** — Foreclosure requiring a lawsuit (South Carolina)
- **Reposting** — Re-scheduling a foreclosure sale for the next month (only sale date changes)
- **ASAP ServiceLink** — Service that provides Substitute Trustee lists per county (updated every 2-3 months)
- **Substitute Trustee** — Person appointed to conduct the foreclosure sale (varies by county)
- **Clio** — Legal practice management software Ben uses for case management
- **VPS** — Virtual Private Server (dedicated hosting for attorney confidentiality)
- **Hard Money Loan** — Short-term, high-interest loan secured by real estate (typically 6-month terms)
- **Zombie File** — A foreclosure file that goes dormant (borrower catches up) then reopens months/years later for another attempt
- **Patch/Overlay** — Merging new document data into an existing File Abstract, preferring newer data on conflicts
- **Title Search** — Report from Ameristar showing all recorded instruments (DOT, assignments, releases) for a property
- **Ameristar** — Title search company Ben uses
- **Recording Information** — First part of legal description: county, survey, abstract, prior deed references
- **Metes and Bounds** — Second part of legal description: directional bearings and distances ("calls") describing the land boundary
- **Subdivision/Lot-Block** — Short legal description for properties inside city limits (block #, lot #, subdivision name)

## Call Log

### Feb 10, 2026 — 56 min call
**Key decisions:**
1. Renamed "Legal Description" sheet → **"File Abstract"** to avoid confusion
2. Legal description must be **split**: recording info paragraph stays in main section, metes & bounds go to Exhibit A
3. Two types of legal descriptions: metes & bounds (rural) vs lot/block (city subdivisions)
4. Assignment of Rents does NOT assign the lien — ignore for foreclosure chain
5. Assignments can be called: "Assignment of DOT", "Assignment of Lien", "Assignment of Contract" — all the same
6. 3-phase document intake: (1) funding pkg + DOT + ServiceLink, (2) title search, (3) zombie reopen
7. ServiceLink fields needed: hours of sale, location of sale, county seat, trustees, date
8. Substitute trustees always start with Ben Wyse + Ted Gambordella, then county-specific from ServiceLink
9. Confirmed $543/month minimum commitment
10. App name: **foreclo.ai**
11. Ben excited about estate planning module as next revenue stream
12. Conrad Properties prepares all their own documents — other clients may have different formats
13. Driver's license + DOB on page 1 of funding package (scanned image — harder to extract)
14. Ben wants login credentials soon to start testing

**Ben's feedback on Raintower/FM455 test:** "Actually did a great job on all the particulars... this is a complicated lender with three different lenders with strange different percentages of ownership."

**Ben's quote on AI training:** "If you can train someone what you want them to do, we can train AI to do the same thing."
