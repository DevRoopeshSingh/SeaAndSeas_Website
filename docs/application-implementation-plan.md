# Application implementation plan

## Inspection and runtime decision

The current `/apply.html` is a branded seven-step vanilla HTML/JS wizard with browser drafts, repeatable family/education/sea service tables, CV uploads, bank details and three declarations. The PHP endpoint validates only core contact fields, stores uploads beneath the web root and emails an HTML summary. It does not create a database application or fill the supplied Word template. The ignored Node prototype has SQLite and a DOCX mapper, but is unavailable on the user's PHP-only Plesk hosting. Its mapper silently ignores missing cells, truncates repeated records, fabricates defaults and overwrites company signature labels. The Node root static handler also exposes private directories. Existing staged changes must be preserved.

The retained original `NEW-APPLICATION-FORMAT-1.docx` has twelve tables, no placeholders, three education rows, four family rows and ten vessel rows. The US visa/MUI data row has six physical cells; MUI number/expiry are cells 4/5. Indian and other-flag certificate tables contain many rows absent from the online wizard. Legal declaration paragraphs and company receiving/signature labels are preserve-only.

## Proposed data model

Use PHP PDO SQLite (consistent with the existing prototype, independent of Node) in a **required private directory outside the document root**. A new PHP-owned `applications` table avoids destructive changes to the Node prototype's `seafarer_applications` table. Searchable columns: random 128-bit identifier, unique application number, full name, position, email, telephone, INDOS, status and submission/update times. Versioned JSON stores every validated scalar and structured family, education, visa, licence, additional certificate and vessel arrays. Passport, medical and bank details remain inside protected JSON, not list responses. Files live under a random application directory. Store relative CV/DOCX references, original name/size, hashed applicant download token, expiry, idempotency-key hash and payload/file fingerprint. An audit table records creation, failures, completion, staff views/downloads and status changes without copying sensitive payloads.

Submission lifecycle: reserve `processing` record transactionally; save CV, generate and atomically rename DOCX; transactionally commit document references, token and `submitted` status. Failed stages mark `failed`, remove partial files and return an error. Reusing the same idempotency key cannot create another record; altered payloads return 409. A CLI recovery command marks abandoned processing records failed and removes their files after a documented timeout. Applicant download capability expires after one hour; staff authenticate with HttpOnly session cookies, a configured password hash, session expiry and CSRF protection. No known/default credentials. Rate limits persist in SQLite.

## Mapping and template strategy

`js/application-schema.json` will be the explicit shared schema/mapping inventory. Every field records its database JSON path and a zero-based table/row/physical-cell location or an exact preserve-aware paragraph replacement. The schema covers all existing controls and missing certificate/course, travel, medical explanation, bank and dry-dock controls. `docs/application-field-mapping.md` expands every scalar, repeated subfield and protected staff-only slot. Generation pins the original template SHA-256, verifies table shape, modifies **only** `word/document.xml`, clones existing row formatting for extra family/education/certificate records, rejects more than ten vessels, and preserves other package parts byte-for-byte. Medical explanation text is inserted with the yes/no answer. Additional certificates use cloned certificate rows within their section. Optional values stay blank; company receiving/signatures and interview cells stay blank for staff.

PDF conversion is optional and will not be added to PHP shared hosting without an available trusted converter. DOCX is the completed application artifact; it can be opened/exported as PDF in Word.

## Planned changes

- `apply.html`, `js/apply.js`, `css/apply.css`: missing fields, shared validation, safe retry, private draft handling; preserve wizard and branding.
- `submit_application.php`: route full applications into the PHP service; retain legacy quick CV intake separately.
- New `includes/application_*.php`, `migrations/001_applications.sql`, `api.php`, `download_application.php`: schema validation, private storage, reliable DOCX generation, transactions/recovery, admin/session/download endpoints.
- `js/admin.js`, `admin.html`: cookie authentication, CSRF mutations and authenticated downloads; retain design and full dossier display.
- `.htaccess`, development router, `.env.example`, `.gitignore`, README/setup and test scripts: PHP routes, denied internal directories, documented extensions/configuration, runtime checks and meaningful integration tests.
- Existing Node libraries remain historical prototypes; remove deployment ambiguity and prevent using their unsafe root static server for production.

## Dependencies and verification

No Composer or production npm additions. PHP 8.2+ extensions: PDO SQLite, DOM/libxml, ZIP, fileinfo, mbstring. Existing PHPMailer is retained for quick intake. PHP native ZipArchive/DOMDocument perform deterministic OOXML edits without re-authoring the template. Install a local PHP runtime for testing. Validate all PHP/JS syntax, shared field coverage, JSON schema consistency, successful/failed submissions, private file access, duplicate retries, admin authorization/CSRF, every mapped table cell, repeat boundaries, archive integrity and declaration/package preservation. Render source and realistic filled DOCX with the documents skill renderer and visually inspect every page; explicitly report any unavailable rendering/Word validation.
