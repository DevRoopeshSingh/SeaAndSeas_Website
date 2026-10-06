# Seafarer application setup and verification

The complete `/apply` workflow uses PHP 8.2+, PDO SQLite and native ZIP/DOM OOXML editing. **Node is needed only for development checks; production does not run Node.** The original seven-step form, branding and declaration remain. See [inspection and design](application-implementation-plan.md) and the [complete field mapping](application-field-mapping.md) for all 465 scalar fields and six repeat groups.

## Runtime and configuration

Enable `pdo_sqlite`, `dom`/libxml, `zip`, `fileinfo` and `mbstring`. Existing PHPMailer also uses the host's SMTP/TLS support. No Composer or npm package was added. Existing JSZip and xmldom packages are used only by the test suite. A local PHP 8.5 runtime was installed for verification; the application requires PHP 8.2 or newer.

Merge these settings into your **existing** `.env` (do not overwrite working SMTP credentials). Process environment variables override `.env`. Keep `.env` out of deployment archives and source control; configure it separately on the server.

| Variable | Setting |
| --- | --- |
| `APP_ENV` | `local` for localhost HTTP; `production` on HTTPS hosting, which enables Secure staff cookies |
| `APPLICATION_PRIVATE_DIR` | Required absolute, writable path outside the project and web document root, e.g. `/var/www/vhosts/DOMAIN/seaandseas-private`; Windows drive paths such as `D:/private/seaandseas` are accepted |
| `ADMIN_USERNAME` | Your authorized crewing staff login name |
| `ADMIN_PASSWORD_HASH` | PHP `password_hash` output; there is no default password |
| `APPLICATION_EMAIL_ENABLED` | `false` by default; `true` plus the scheduled notification worker enables reference-only staff emails |
| Existing `MAIL_*`, `FORM_SUBMISSION_TO` | Continue to configure PHPMailer for quick CV intake and optional staff notifications |

Generate the hash locally or in a private SSH/terminal session. The command outputs a hash, never a default credential. The readline prompt may echo input; use a private terminal.

```bash
php -r 'echo password_hash(readline("Staff password: "), PASSWORD_DEFAULT), PHP_EOL;'
```

Assign that output to `ADMIN_PASSWORD_HASH` in `.env`. Restrict `.env` and private storage to the site's PHP account. On Linux use directories `0700`, files `0600`; do not use world-writable permissions. On Windows grant the site's PHP identity access using NTFS ACLs and remove broad user access. Do not choose a network filesystem for SQLite WAL.

## Local workflow

From the repository root, configure `.env` as above with `APP_ENV=local` and, for example, `APPLICATION_PRIVATE_DIR=/tmp/seaandseas-local-private`. Then run:

```bash
php scripts/application-preflight.php
php -d upload_max_filesize=10M -d post_max_size=12M -d max_input_vars=3000 -S 127.0.0.1:8000 scripts/php-router.php
```

For a local checkout with missing settings, run `php scripts/configure-local-admin.php --local` first. It preserves mail settings, adds only missing application settings, initializes private temporary storage outside the site, and prints a randomly generated password once. It stores only the password hash in `.env` with owner-only permissions. It will not replace existing staff credentials or modify a configuration explicitly marked non-local. Keep the displayed password privately. Temporary storage is for fictional test data; configure a permanent private directory for real applications.

If admin login fails, run preflight first. There is no default staff password: missing credentials or private storage prevent login. Use the PHP server URL, not `file://` or a static preview. Local HTTP requires `APP_ENV=local`; hosting requires HTTPS and `APP_ENV=production`. The admin API now calls `/api.php?route=...` directly, so login and downloads do not depend on `/api` rewrite rules. `/admin.html` also works if the clean `/admin` route is unavailable. Hard-refresh after deploying the updated admin files. A successful login must also pass the session check before the roster opens.

Preflight verifies PHP extensions, staff configuration, private storage and the original DOCX fingerprint, and initializes the database. Visit `http://127.0.0.1:8000/apply` and `http://127.0.0.1:8000/admin`. The PHP development server is for local testing only. A static Python server cannot submit applications.

1. Enter a fictional applicant such as Arjun Nair, rank `2nd Officer`, DOB `1992-05-18`, nationality Indian, email `arjun.nair@example.test`, mobile `+91 9876543210`, height `178`, weight `76`. Fill all fields marked required. Choose actual listed options for relationship, shoe and boiler-suit size. Leave unrelated optional certificates and NRI fields empty.
2. Add a spouse and child, one education record, two certificates and two sea-service records. Example vessel: owner Ocean Fleet Management, MV Ocean Pearl, built 2014, Oil Tanker, GRT 42000, DWT 75000, MAN B&W, BHP 12000, Second Officer, `2025-01-01` to `2025-07-01`, reason Contract completed. Duration is recalculated on the server.
3. Answer a medical question Yes and verify its explanation becomes required; change it to No to check optional behavior. Complete any U.S. visa or NRI account fields if that conditional group applies.
4. Attach a genuine PDF/DOC/DOCX CV up to 10 MB. Accept the three existing declarations, type the same full name, and enter signature date/place. Submit once. The page must show a real `SS-APP-YYYY-XXXXXXXXXXXX` number and a DOCX download link valid for one hour.
5. Download and open the DOCX in Microsoft Word. Check all sections, family and vessel rows, blank optional cells, wages, bank fields, signature/date and untouched declaration. Export a PDF in Word if needed. This does not enable server PDF generation.
6. Sign in at `/admin`. Search by application number/name/email/INDOS, open the complete dossier, download DOCX and CV, and update review status. Sign out; private downloads and application API requests must then fail without authorization. An anonymous browser with the applicant's one-hour capability can download only that completed DOCX.
7. Try an invalid phone, missing declaration, Yes medical answer without explanation, reversed dates, fake PDF and an eleventh vessel. Correctable errors must appear on the relevant step. If a network failure occurs, retry with the same data and CV; the retained idempotency key prevents another record. Use Reset Draft only when intentionally starting a different application.

The draft is saved only in the current browser tab's session storage and is cleared on success. A CV cannot be restored after a reload; reattach it. Close the tab after use on a shared computer.

## Database and failure recovery

`migrations/001_applications.sql` runs idempotently on initialization. It creates `applications`, `application_audit`, `rate_limits` and `application_notifications`, plus search indexes, inside `APPLICATION_PRIVATE_DIR/applications.sqlite`. No existing Node database or legacy record is deleted or imported. Core columns support staff searches; versioned `data_json` holds validated fields and structured arrays. Files are under `files/<random-id>/`; sessions are outside the web root as well.

The service reserves `processing` in a transaction, writes CV and a temporary DOCX, atomically renames the DOCX, then commits its references, hashed download capability and `submitted` status together. A failure returns an error and removes partial files, with a retained `failed` record. Same-key, same-payload retry can recover it. A changed payload with that key returns 409. Staff cannot download or promote incomplete records.

Schedule hourly, using the same PHP version, site account and environment as the web handler:

```bash
php /ABSOLUTE/SITE/PATH/scripts/recover-applications.php
```

This marks processing records older than one hour failed, clears file references and deletes abandoned partial files. It does not erase submitted applications. If the host exceeds that processing duration, investigate before adjusting the timeout. Disk/database failures may prevent recording a failure; the recovery job resolves stale reservations after storage returns.

Optional notifications: set `APPLICATION_EMAIL_ENABLED=true`, verify existing SMTP credentials privately, and schedule every five minutes:

```bash
php /ABSOLUTE/SITE/PATH/scripts/send-application-notifications.php
```

The worker emails staff only the application number, sends no dossier/CV, retries up to ten attempts and records audit events. Delivery is at least once: a crash after SMTP acceptance can repeat a notification. SMTP failure never changes application completion. It was not run against live mail during testing.

Back up the database **and** generated/uploaded files together into private storage. Use SQLite's online backup facility, or stop writes while copying the database and its WAL/SHM files; do not copy just a live `.sqlite` file. Restrict backups like the originals. Establish your applicant-retention policy separately; this change does not automatically delete applications.

## Plesk deployment

The host OS was not confirmed. Check the panel's hosting/server information or ask the provider. Windows/IIS routing and NTFS permissions have not been integration-tested in this environment.

Upload the existing public HTML/CSS/JS/images and required PHP files: `submit_application.php`, `api.php`, `download_application.php`, `includes/`, `phpmailer/`, `migrations/`, and the original `NEW-APPLICATION-FORMAT-1.docx`. Include the recovery/notification/preflight CLI scripts for scheduled tasks. Deploy `.htaccess` on Apache, or `web.config` on IIS with URL Rewrite installed/enabled. Do not upload Node prototypes (`server.js`, `lib/`, `node_modules/`), tests, QA files, database contents, deployment ZIPs or `test-mail.php`. Configure `.env` privately after upload. Retain the original template bytes; a changed template fails closed until its mapping is reinspected.

Set PHP `upload_max_filesize=10M`, `post_max_size=12M`, `max_input_vars=3000`, `memory_limit` at least `128M`, and an appropriate execution timeout (e.g. 60 seconds). Use HTTPS and `APP_ENV=production`. Run preflight with the site's PHP binary and site account; `open_basedir` must explicitly include your private directory and PHP temporary upload directory. The private directory must be outside `httpdocs` and any other served document root.

**Apache with nginx proxy:** `.htaccess` provides clean routes and denies internal files. In Plesk, disable nginx “Serve static files directly” for this site or ensure equivalent deny rules on nginx: direct static serving can bypass Apache's protections. Requests to `/.env`, `/includes/application_bootstrap.php`, `/NEW-APPLICATION-FORMAT-1.docx`, `/uploads/`, `/data/`, `/storage/` and `/applications_archive/` must return 403/404. Test these after upload. Full applications are private outside the document root regardless of static rules; the denies also protect legacy quick-intake files.

**nginx-only:** have the hosting administrator configure the standard PHP/FastCGI handler plus these deny/rewrite rules in the server block. These require server configuration access and are not interpreted from `.htaccess`:

```nginx
location ~ (^|/)\. { deny all; }
location ~* ^/(includes|phpmailer|lib|data|storage|uploads|applications_archive|tests|scripts|migrations|docs|node_modules)(/|$) { deny all; }
location ~* ^/(NEW.*\.docx|server\.js|package(-lock)?\.json|test-mail\.php)$ { deny all; }
location ~* \.(sql|sqlite.*|db.*|log|zip)$ { deny all; }
rewrite ^/apply/?$ /apply.html last;
rewrite ^/admin/?$ /admin.html last;
rewrite ^/api/(.*)$ /api.php?route=$1 last;
```

Preserve query strings and ensure deny locations take precedence over the host's general static/PHP locations. Validate nginx configuration before reload.

**Windows IIS:** `web.config` includes routes and internal-file denies under IIS URL Rewrite. Ask the provider to enable and unlock URL Rewrite before deployment; an unavailable/locked module causes HTTP 500.19. Existing locked request-filtering/security sections were not added. Configure an outside-web-root absolute drive path and NTFS ACLs for private storage, enable PDO SQLite/ZIP/DOM/mbstring, and run preflight using the site's PHP CLI. Verify the same blocked routes and the full submission/admin flow. OS-specific production checks remain required.

Use a private backup of the current live site before deploying. Keep archives outside public storage. No live deployment or application-record migration was performed here.

## Automated verification

On a development machine with Node and PHP:

```bash
npm ci
npm run lint
npm test
npm run build
```

`lint` checks all project PHP and JavaScript syntax. `build` verifies the static deployment inventory, field coverage, extensions and pinned template; this vanilla site has no bundler or TypeScript type-check command. Tests start an isolated localhost PHP server with synthetic credentials and an isolated temporary database, send no mail, and write ignored QA DOCX files under `test-output/`. Do not run against production records. Failure-injection permission checks require a non-root POSIX development account.

The integration suite covers optional blanks, conditional medical answers, full scalar mapping to exact cells, repeat overflow, ten-vessel limits, date/declaration/upload validation, idempotency, staff sessions/CSRF, applicant expiry, private access, audit records, failed template/storage/database stages and recovery. All non-`word/document.xml` DOCX entries are compared byte-for-byte with the source, including logos, styles, headers and footers. Declaration paragraphs are compared exactly.

Document QA uses LibreOffice rendering to inspect completed copies and convert them to PDFs for verification only. Browser automation and native Microsoft Word are unavailable in this session; the manual wizard/responsive/Word checks above remain necessary.

Verified locally on 2026-10-06: **44 integration checks passed**, PHP/JavaScript lint passed (17 PHP and 10 JavaScript files), static build checks passed, template preflight passed and IIS configuration XML parsed. Admin login, session persistence, roster access and logout were also verified against the configured localhost server. The tests cover direct PHP routing, incorrect passwords, missing configuration, safe local setup and preservation of existing credentials/mail settings. Three generated sample documents rendered successfully (8, 10 and 9 pages), with every page visually reviewed during the original implementation. These checks include exact cell destinations, licence rows, overflow rows, byte-identical non-document ZIP parts and unchanged declarations. PDF conversions were QA-only, not a production feature.

## Template behavior and limits

The generator uses the explicit twelve-table, physical-cell map, not appended applicant text or approximate label matching. It clones styled rows for family/education/extra visa/certificate overflow. Up to ten vessels are accepted. Additional licences clone rows within the licence section; additional course/certificate rows go inside the other-courses table. Include the issuing flag/category in certificate names. Original empty fixed cells stay blank. More populated/longer records naturally add pages.

Completed copies remove the U.S. visa cell merges that hid data, let filled rows expand and stay together, move the landscape table below the header, and reduce numeric sea-service cell margins to keep numbers legible. Source bytes, table widths/orientation, logos and legal declaration are preserved. Office interview cells and company receiving/signature slots remain blank for staff to complete in Word. Applicant name/date/place provide a typed acknowledgement, not a handwritten signature.

Server PDF generation is not included because no production converter is confirmed. Staff currently share one configured `crewing_officer` account; a multiple-staff identity directory, per-user role management, file malware scanning, encrypted database volumes and long-term retention automation are outside this change. Private storage and authenticated/expiring downloads protect application access, but volume encryption and backup access must be configured by the host.

## Changed files

| Area | Files |
| --- | --- |
| Applicant UI | `apply.html`, `js/apply.js`, `js/application-validation.js`, `js/application-schema.json`, `css/apply.css` |
| Staff UI | `admin.html`, `js/admin.js` |
| PHP service | `submit_application.php`, `api.php`, `download_application.php`, `includes/application_bootstrap.php`, `includes/application_validation.php`, `includes/application_docx.php`, `includes/application_submission.php`, `includes/mailer.php` |
| Persistence | `migrations/001_applications.sql` |
| Routing/configuration | `.htaccess`, `web.config`, `.env.example`, `.gitignore`, `package.json`; existing dependency lockfile retained for repeatable dev installs |
| Tools/tests | `scripts/php-router.php`, `scripts/application-preflight.php`, `scripts/configure-local-admin.php`, `scripts/check-application.js`, `scripts/recover-applications.php`, `scripts/send-application-notifications.php`, `scripts/build-application-schema.js`, `scripts/extend-application-form.js`, `tests/application.test.js` |
| Documentation | `README.md`, `docs/application-implementation-plan.md`, `docs/application-field-mapping.md`, `docs/application-setup.md` |

`build-application-schema.js` regenerates the schema and mapping from the inspected cells and online control metadata. Review mapping changes before running it after a template change. `extend-application-form.js` records the one-time form extension; it is not a migration and must not be rerun on the completed HTML. Pre-existing staged website/template/Node prototype changes were retained.
