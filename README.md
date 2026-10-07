# Sea & Seas Shipping Private Limited ⚓

> **Official Website & Digital Portal for Sea & Seas Shipping Pvt. Ltd.**  
> Global Crew Management, Technical Superintendence & Port Agency Services.  
> **Domain**: [seasshipping.com](https://seasshipping.com/)

---

## 📋 Overview

**Sea & Seas Shipping Private Limited** is an ISO 9001:2015 certified maritime crew management, technical superintendence, and ship agency firm headquartered in **CBD Belapur, Navi Mumbai (India)** with operational representation in **Ajman / Sharjah (United Arab Emirates)**. The company is a certified member of the **International Maritime Federation (IMF)** and the **Maharashtra Chamber of Commerce, Industry & Agriculture (MACCIA)**.

This repository contains the official website's HTML/CSS/JavaScript and PHP application backend. The public pages use vanilla JavaScript; full seafarer applications require PHP, private SQLite storage and the original Word template.

---

## ✨ Features

* **High-Performance Static Architecture**: Zero heavy frontend frameworks or build steps required. Extremely fast load times and minimal server overhead.
* **Responsive Modern UI**: Designed with a maritime-inspired visual palette (Deep Navy `#10233C`, Royal Blue `#183358`, Electric Lime `#A7DB28`), custom typography (Inter, Big Shoulders Display, IBM Plex Mono), and smooth micro-interactions.
* **Seafarer Application Workflows**:
  * **Quick CV Intake**: Homepage form with rank, contact information, INDOS/CDC details and a CV attachment, delivered through the existing PHPMailer mail configuration.
  * **Full Bio-Data Application**: Seven-step Form RPS 01-A with 465 scalar fields and six repeat groups, validated on the browser and server, saved privately with a completed Word document.
  * **Staff Portal**: Authenticated roster search, complete dossier review, status updates and protected CV/Word downloads. INDOS/CDC details are captured; this code does not connect to a government verification service.
* **Interactive Operations & Fleet Sections**:
  * Keyboard-accessible collapsible service accordions.
  * Live-animated data counters and trade route diagrams.
  * Technical fleet specification showcases.
* **Quick Contact & Direct Inquiries**: Corporate contact channels with direct routing to crewing desks in India and the UAE.
* **SEO & Social Sharing Ready**:
  * Full OpenGraph and Twitter Card metadata.
  * Schema.org `Corporation` JSON-LD structured data with dual-location address mapping.

---

## 📂 Project Structure

```text
Seaandseas/
├── README.md / .env.example # Documentation and configuration template
├── .htaccess / web.config  # Apache and IIS routing/access controls
├── index.html              # Homepage and quick CV intake
├── apply.html / admin.html # Applicant wizard and staff portal
├── submit_application.php  # Full application processing and quick CV intake
├── api.php                 # Staff authentication, search, review and downloads
├── download_application.php # Expiring applicant Word download
├── NEW-APPLICATION-FORMAT-1.docx # Pinned original application template
├── css/                    # Homepage and applicant styles
├── js/                     # Browser code, shared validation and field schema
├── image/                  # Photography, logos and membership assets
├── includes/               # PHP storage, validation, Word generation and mail
├── phpmailer/              # Existing mail library
├── migrations/             # Additive SQLite schema
├── scripts/                # Development, packaging and CLI operations tools
├── tests/                  # Isolated synthetic integration tests
├── docs/                   # Field mapping, setup and production release guide
├── releases/               # Generated ZIP/manifest/settings example (ignored)
└── test-output/            # Synthetic QA Word files (ignored; never deploy)
```

Production database, CVs, generated documents and staff sessions belong in `APPLICATION_PRIVATE_DIR`, **outside this project and every public document root**. Root logos/images are also included in the production package. `lib/` and the ignored `server.js` are historical Node prototypes, not production handlers. Existing legacy uploads/roster files must remain protected during an upgrade.

---

## Local development and application processing

The complete `/apply` workflow runs on **PHP 8.2+**, with a private PDO SQLite database and table-mapped DOCX generation from `NEW-APPLICATION-FORMAT-1.docx`. Production supports PHP-only Plesk hosting; Node is used only for development tests. The older Node prototype is not the deployment entry point.

Configure `APP_ENV=local`, `APPLICATION_PRIVATE_DIR`, `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` as described in the [setup and end-to-end testing guide](docs/application-setup.md). Private storage must be outside the web document root. There is no default staff password. For missing local settings, `php scripts/configure-local-admin.php --local` creates only the missing settings and prints a generated password once; it preserves existing credentials/mail settings and refuses explicitly non-local configuration. Never run that setup script on production.

```bash
php scripts/application-preflight.php
php -d upload_max_filesize=10M -d post_max_size=12M -d max_input_vars=3000 -S 127.0.0.1:8000 scripts/php-router.php
```

Open `http://127.0.0.1:8000/apply` for applicants and `/admin` for authorized staff. Applicants receive an application number and an expiring private DOCX download after their data and document are saved. Staff use password-hash authentication, HttpOnly sessions and protected dossier/CV/DOCX downloads. Drafts stay in the current browser tab. Optional reference-only notification emails use the existing PHPMailer configuration and a scheduled worker.

## Mapping, tests and deployment

The [inspection and data-model plan](docs/application-implementation-plan.md) and [complete field mapping](docs/application-field-mapping.md) document every scalar and repeat group. No legal declaration text or original template bytes were changed.

```bash
npm ci
npm run lint
npm test
npm run build
npm run package:production
```

These are development checks, with isolated synthetic PHP integration tests. Tests require permission to bind a localhost PHP server, use temporary private storage, send no mail, and must run under a non-root POSIX account for the storage-permission failure checks. The vanilla website has no TypeScript compilation or asset bundling step. Node dependencies are development tools and are not required on the production host.

Verified locally on **7 October 2026**, using PHP **8.5.11** on macOS: **52 integration checks passed**; syntax checks passed for **17 PHP and 11 JavaScript files**; static build checks passed for **465 scalar fields**, **six repeat groups**, and the pinned Word template. Tests cover data mapping, duplicate retries, staff authorization/CSRF, private routes, expiry, failure recovery, safe storage/database configuration errors and preservation of the template's declarations and non-document ZIP parts. The added IIS access-rule regression checks the deny expression; it does not replace an integration check on the Windows host.

`npm run package:production` runs the build checks and writes this release's files:

```text
releases/seaandseas-production-20261007.zip
releases/seaandseas-production-20261007.manifest.json
releases/production-settings.example
```

The ZIP contains 48 deployment files: public assets, PHP handlers/libraries, the original Word template, migration, routing and three CLI operations scripts. The manifest records each file's SHA-256 and the source commit, including whether working-tree changes are present. Secrets, `.env`, databases, applicant files, the legacy roster, Node prototypes/dependencies, tests, QA output and `test-mail.php` are excluded. Keep the ZIP/manifest/settings example outside public storage and configure server secrets separately. Do not use the older September deployment ZIPs for this release. The packaging command currently uses the fixed `20261007` release filename; update it deliberately for a later release.

## Confirmed PleskWin configuration and release readiness

The PHP Settings screenshot and phpinfo PDF supplied on **7 October 2026** confirm Windows Server 2022, Microsoft IIS 10, PleskWin, and PHP **8.5.11** using CGI/FastCGI. The document root is `D:/Inetpub/vhosts/seasshipping.com/httpdocs`.

| Setting | Captured server value | Application requirement / action |
| --- | --- | --- |
| PHP | 8.5.11, CGI/FastCGI | Meets the minimum PHP 8.2 requirement; verify using the site's actual handler and CLI |
| PDO SQLite | Enabled; PDO drivers include `sqlite` | Required; available |
| DOM, ZIP, fileinfo, mbstring | Enabled | Required; all available |
| `memory_limit` | `128M` | At least `128M`; captured value meets the minimum |
| `max_execution_time` / `max_input_time` | `60` / `60` seconds | Captured values match the deployment recommendation |
| `upload_max_filesize` | `2M` | **Change to `10M`** for the advertised CV size |
| `post_max_size` | `8M` | **Change to `12M`** to allow the CV plus form/multipart overhead |
| `max_input_vars` | `1000` | **Change to `3000`** for the complete application form |
| `open_basedir` | Subscription root `D:/Inetpub/vhosts/seasshipping.com/` and `C:/Windows/Temp/` | Covers the site's sibling `private` directory; preserve the restrictions |
| Error handling | Display errors off; log errors on | Keep errors private and inspect Plesk Logs when diagnosing failures |

Set the three limits in the domain's PHP Settings and click **Apply**. If a field is unavailable, ask the host to set it for the site's handler. Reopen **View the phpinfo() page** and verify the **Local Value** column. The captured PDF predates these changes; it does not prove they have been applied.

**Current readiness: the production storage error is resolved; full acceptance remains pending.** On 7 October, eight public assets matched the 6 October release after normalizing Windows line endings. In the authorized Plesk session, `httpdocs/.env` had `APPLICATION_PRIVATE_DIR=C:/Inetpub/vhosts/seasshipping.com/private`, although the site's actual subscription is on drive `D:`. Only that setting was corrected to `D:/Inetpub/vhosts/seasshipping.com/private`, using the existing sibling folder outside `httpdocs`. Staff credentials and mail settings were preserved; no ACL or `open_basedir` changes were needed.

After saving, `/api.php?route=admin/me` returned **401** with `Staff sign-in required.` rather than 503. This route initializes private storage and SQLite before checking the staff session, so the response confirms successful initialization through the site's web handler. The browser displayed the staff login form. HEAD checks returned **200** for `/`, `/apply` and `/admin`, and **403** for all ten private paths in the acceptance checklist below, including the legacy roster. No applicant records were downloaded.

**Staff authentication is now verified.** The initial password noted in the server setup comment did not match the configured hash; the user subsequently applied a privately generated replacement hash. A live API check then returned **200** with successful login, **200** for the authenticated `admin/me` request identifying the configured staff user, and **200** for logout of the temporary verification session. This verifies login and authenticated session continuity through the API; browser roster operation and denial after logout still need their acceptance checks. Credentials are not included in this documentation. The required extensions are present in the supplied PDF. Existing-record availability, generated documents, scheduled workers and the effective upload limits still need verification. The SQLite initialization does not import the legacy JSON roster; preserve those records and verify any required migration separately. Complete the preflight and remaining live acceptance checks before marking the release accepted.

### Diagnosing the admin API's 503 response

The reviewed API now reports fixed configuration messages with an error `code` for known storage/database setup failures, without returning absolute paths, passwords, hashes, SQL or underlying exception text. Unknown errors still use the generic message. Deploy `api.php` **together with** `includes/application_bootstrap.php`, the updated preflight script and the migration; a page refresh alone cannot update the backend.

| API error code | Server action |
| --- | --- |
| `private_storage_path_invalid` | Set an absolute path for the server OS; Windows requires a drive path such as `D:/...`, not a local macOS path |
| `private_storage_public` | Use a private directory outside `httpdocs` and any other served document root |
| `private_storage_unavailable` | Match the drive and subscription path to the site's actual document root, then check folder existence, `open_basedir` and NTFS access. This site's failure was a `C:` path on a `D:` subscription |
| `private_storage_not_writable`, `private_subdirectory_unavailable`, `private_subdirectory_not_writable` | Grant the site's PHP account the required access to the private directory and its `files`/`sessions` children |
| `sqlite_driver_unavailable` | Enable PDO SQLite for the site's actual PHP handler |
| `database_migration_missing` | Upload the original `migrations/001_applications.sql` and verify PHP can read it |
| `database_open_failed` | Check access to the private SQLite database and parent folder; preserve existing records |
| `database_initialize_failed` | Check database/journal permissions, disk space and the deployed migration; run preflight |

In Plesk Scheduled Tasks, run a **PHP script** using the site's PHP version/account, with this script path:

```text
D:/Inetpub/vhosts/seasshipping.com/httpdocs/scripts/application-preflight.php
```

Use the task's file picker to select `httpdocs/scripts/application-preflight.php`; if the subscription panel expects a relative path, enter that rather than the absolute path above. Use **Run Now** to capture its output. See [Plesk's scheduled task instructions](https://docs.plesk.com/en-US/obsidian/reseller-guide/website-management/scheduling-tasks.70617/). The script is CLI-only and cannot be run by visiting its URL. Configuration failures include their code; SQLite failures also report SQLSTATE/driver codes. Preflight checks credentials without printing them, and initializes the private database through the additive migration. A Plesk task's account may differ from the web handler's identity, so successful CLI output must still be followed by a web check. When configured, `/api.php?route=admin/me` should return **401** before sign-in.

If the old generic error persists after deploying, verify the paired PHP files were updated and check Plesk Logs for the latest `Application API` entry. Share only the error code or preflight output when troubleshooting; keep `.env` credentials and applicant data private. Do not delete/reset the application database to resolve a setup error.

## Production configuration and delivery

The verified storage path for this site is the existing sibling folder `D:/Inetpub/vhosts/seasshipping.com/private`, outside `httpdocs` and inside the captured `open_basedir` allowance. For a new installation, create a private sibling folder and grant only the required site/hosting identities access through NTFS ACLs. The following shows the verified path and recommended production/test-notification settings; the latter settings still need separate verification:

```dotenv
APP_ENV=production
APPLICATION_PRIVATE_DIR=D:/Inetpub/vhosts/seasshipping.com/private
APPLICATION_EMAIL_ENABLED=false
```

For an existing application database, **retain its current valid private storage path**; changing it without migrating the database and files would make existing records disappear from the roster. Never deploy a local macOS `/tmp` or `/Users/...` path to Windows.

Configure `ADMIN_USERNAME` and a real PHP `password_hash` value for `ADMIN_PASSWORD_HASH` privately. Preserve existing staff credentials and SMTP settings; do not copy placeholders over working settings. Prefer a private `.env` above `httpdocs`; the loader uses the first readable file in `httpdocs/.env`, `httpdocs/includes/.env`, then the parent `.env`, so an existing file in the document root must be merged or deliberately migrated. Process environment variables take precedence. See [application setup](docs/application-setup.md) for password-hash creation and permissions.

1. Make a private Plesk backup of the live site/settings and a consistent backup of the application database **with** its files. SQLite WAL requires an online backup or stopped writes; copying just a live `.sqlite` file is insufficient.
2. Apply and verify the PHP limits above; confirm IIS URL Rewrite is installed/enabled and the site's PHP account can read configuration and write private storage.
3. Run `php scripts/application-preflight.php` from the release directory using the site's PHP binary, account and production configuration. Use private staging before switching if available, or a controlled deployment window with a Plesk PHP scheduled task. Success must report private storage/additive migration and template/extension checks as OK. Preflight initializes the database; it does not verify all web-handler limits, IIS routing or the browser workflow.
4. Extract the reviewed release ZIP into the actual `httpdocs` root, overwriting release code/assets while preserving server configuration and runtime records. Deploy the corrected `web.config`. Keep archives, manifests, diagnostic tools and test files out of public storage. Production does not run `server.js`, `npm start` or the PHP development server.
5. Schedule `scripts/recover-applications.php` hourly with the same PHP/account/configuration. If reference-only staff notification emails are needed, verify SMTP/recipient settings privately, set `APPLICATION_EMAIL_ENABLED=true`, and schedule `scripts/send-application-notifications.php` every five minutes. The worker sends real mail when enabled.
6. Complete the live acceptance checks below. If they fail, follow the [release and rollback guide](docs/production-release-20261007.md), preserving new applications and keeping the roster deny rule in place.

### Live acceptance checks

- Homepage, `/apply` and `/admin` load through HTTPS. Applicant/staff assets load after a hard refresh.
- An unauthenticated request to `/api.php?route=admin/me` returns **401**, rather than 503. Staff login persists, searches work, and logout prevents private API/download access.
- HEAD/status checks to `/.env`, `/applications_roster.json`, `/NEW-APPLICATION-FORMAT-1.docx`, `/includes/application_bootstrap.php`, `/data/`, `/storage/`, `/uploads/`, `/test-output/`, `/scratch/` and `/test-mail.php` return **403 or 404**. Do not download private content to perform these checks.
- With notifications disabled for the smoke test, submit a clearly marked synthetic application, confirm its real application number, download/open the completed Word document, and verify the dossier in the staff portal. Keep deployment QA identifiable and preserve real records.
- Verify quick CV intake separately with a designated test recipient; it uses the mail workflow and sends actual email.

The [setup guide](docs/application-setup.md) covers mapping, recovery, notifications, private backups and alternative Apache/nginx hosting. Server PDF generation is not included; staff can export the completed DOCX from Word. Basic Windows storage access is verified by the repaired API, but ACL scope and the full production workflow still require the remaining checks above. Passing local checks or pushing source to Git does not configure or deploy Plesk.

---

## 🏢 Corporate Contact Information

* **India Headquarters**:
  * **Address**: 410, 4th Floor, Concorde Building, Plot No. 66A, Sector-11, C.B.D. Belapur, Navi Mumbai, Maharashtra 400614, India.
  * **Phone**: +91-22-49673720 / +91-22-49246060
  * **Email**: `crewing@seasshipping.com`
* **UAE Operations**:
  * **Address**: Port Area, Serving Ajman, Sharjah, Sharjah Khalid Port & Hamriyah Ports, United Arab Emirates.
  * **Email**: `uae@seasshipping.com`

---

## 📄 License & Copyright

© 2008–2026 **Sea & Seas Shipping Private Limited**. All rights reserved.  
ISO 9001:2015 Certified | STCW 2010 | MLC 2006 | RPS Rules 2005.
