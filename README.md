# Quotation Document Generator

A full-stack enterprise web application built with **Next.js**, **React**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM (SQLite)** to eliminate manual preparation of quotation and proposal documents.

---

## 🌟 Key Features

1. **Master Template Immutability Guaranteed**:
   - Master templates in `/templates/` are treated as strictly read-only and never modified or overwritten.
   - Built-in automated SHA-256 golden hash testing validates that every master template remains 100% untouched.

2. **Automated OpenXML Stream Normalizer & Template Analyzer**:
   - Parses DOCX XML structures across paragraphs, tables, headers, and footers.
   - Handles bracket placeholders (`[Customer Name]`, `[Quotation No]`, `[Amount]`) even when Microsoft Word splits text across multiple `<w:r>` runs.
   - Detects styled red-text formatting candidates and classifies them into `EDITABLE` vs `STATIC` fields.
   - Dynamically infers field types (text, textarea, currency, date, dropdowns, checkboxes).

3. **Live 3-Panel Quotation Studio (`/quotations/[id]/edit`)**:
   - **Left Panel**: Section navigation with real-time completion checkmarks.
   - **Center Panel**: Dynamic form generated purely from template metadata (zero hardcoded forms!).
   - **Right Panel**: Live high-fidelity DOCX document preview with zoom and refresh.

4. **Multi-Format Export & Persistent Document Storage**:
   - Clones the master template and replaces values at the OpenXML run level while strictly preserving styles, fonts, margins, tables, headers, and images.
   - Multi-tier PDF generation adapter (LibreOffice CLI with configurable path + fallback).
   - Generates and stores files in `/storage/generated/{template-slug}-{customer-slug}-{timestamp}-{id}/`.

5. **Snapshot-Based Version History**:
   - Creates automatic versions (`v1`, `v2`, `v3`) on edit.
   - 1-click restore functionality to rollback to any previous version.

6. **Zero-Code Future Template Addition**:
   - Drop any new `.docx` file into `/templates/docx/{template-slug}/template.docx`.
   - The application automatically discovers, analyzes, and registers the template.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, `docx-preview`
- **Backend**: Next.js Route Handlers / Server Actions, Node.js
- **Database**: SQLite with Prisma ORM
- **Document Processing**: OpenXML Parser, JSZip, LibreOffice headless conversion adapter
- **Storage**: Persistent local filesystem storage

---

## 📁 Directory Structure

```
├── app/
│   ├── api/
│   │   ├── templates/          # Template listing, inspect & field configuration APIs
│   │   ├── quotations/         # Quotation CRUD, generation, download, and version APIs
│   │   ├── dashboard/          # Dashboard analytics API
│   │   └── settings/           # Company settings API
│   ├── templates/              # Template management & inspection pages
│   ├── quotations/             # Quotation hub, wizard, and 3-Panel Studio
│   ├── settings/               # System settings page
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── layout/                 # Sidebar, Header, AppShell
│   ├── dashboard/              # StatsCards, TemplateGrid, RecentQuotationsTable
│   └── quotations/             # DocxPreview, DynamicForm, SectionNav, VersionHistoryModal
├── lib/
│   ├── db.ts                   # Prisma client instance
│   ├── services/
│   │   ├── template-service.ts
│   │   ├── template-analyzer.ts
│   │   ├── placeholder-detector.ts
│   │   ├── red-text-detector.ts
│   │   ├── docx-generator.ts
│   │   ├── pdf-generator.ts
│   │   ├── quotation-service.ts
│   │   ├── version-service.ts
│   │   ├── storage-service.ts
│   │   └── settings-service.ts
│   ├── utils/                  # Sanitize, XML helpers, Numbering
│   └── types/                  # TypeScript interfaces
├── prisma/
│   ├── schema.prisma           # Prisma SQLite schema
│   └── seed.ts                 # Database seed script
├── templates/                  # Read-only Master Templates
│   ├── docx/
│   └── pptx/
├── storage/                    # Persistent storage for generated documents
│   ├── generated/
│   ├── temp/
│   └── previews/
└── tests/                      # Automated test suite & golden immutability tests
```

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
- Node.js 18+ (tested on Node v22)
- npm 9+
- Optional: LibreOffice (for native DOCX to PDF conversion)

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database & Scan Templates
```bash
# Push schema to SQLite
npm run db:push

# Scan master templates and seed demo quotation
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Automated Tests

Run the complete test suite:
```bash
npm test
```

This executes:
1. **Placeholder & Split-Run Normalization Tests**: Validates detection across arbitrary Word `<w:r>` run boundaries.
2. **Golden Master Template Immutability Test (Mandatory)**: Verifies that SHA-256 hashes of all 13 master DOCX templates remain 100% identical before and after document generation.
3. **End-to-End Quotation Lifecycle & Versioning Tests**: Verifies creation, dynamic updating, version snapshots (`v1` -> `v2` -> restore `v3`), and duplication.

---

## ➕ Adding Future Templates

To add a new quotation template without touching application code:

1. Create a directory: `templates/docx/my-new-template/`
2. Place your Word document: `templates/docx/my-new-template/template.docx`
3. Run `npm run templates:scan` (or click **Scan & Sync Templates** in the UI).
4. The system will automatically detect placeholders, red text, and sections, and make it available in the gallery.

---

## 📄 License & Attribution
Developed for Lentera Technologies & Quotation Automation Systems.
