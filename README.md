# Sea & Seas Shipping Private Limited ⚓

> **Official Website & Digital Portal for Sea & Seas Shipping Pvt. Ltd.**  
> Global Crew Management, Technical Superintendence & Port Agency Services.  
> **Domain**: [seasshipping.com](https://seasshipping.com/)

---

## 📋 Overview

**Sea & Seas Shipping Private Limited** is an ISO 9001:2015 certified maritime crew management, technical superintendence, and ship agency firm headquartered in **CBD Belapur, Navi Mumbai (India)** with operational representation in **Ajman / Sharjah (United Arab Emirates)**. The company is a certified member of the **International Maritime Federation (IMF)** and the **Maharashtra Chamber of Commerce, Industry & Agriculture (MACCIA)**.

This repository contains the complete production-grade source code for the official website, built with modern HTML5, Vanilla CSS3, and ES6+ JavaScript.

---

## ✨ Features

* **High-Performance Static Architecture**: Zero heavy frontend frameworks or build steps required. Extremely fast load times and minimal server overhead.
* **Responsive Modern UI**: Designed with a maritime-inspired visual palette (Deep Navy `#10233C`, Royal Blue `#183358`, Electric Lime `#A7DB28`), custom typography (Inter, Big Shoulders Display, IBM Plex Mono), and smooth micro-interactions.
* **Dual-Track Inquiry Portal**:
  * **Shipowner & Principal Inquiries**: Vessel specifications, required crew complement, trading areas, and service requests.
  * **Seafarer Career Applications**: Full ranking options (Master to Ratings), INDOS/CDC verification, and CV attachment upload feedback.
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
SeaAndSeas_Website/
├── .gitignore              # Ignores OS metadata and deployment archives
├── README.md               # Project documentation
├── index.html              # Main production landing page (~48 KB)
├── SeaAndSeas_Website.html # Source HTML mirror
├── website.html            # Source HTML mirror
├── hero-ship.jpg           # High-resolution hero vessel photography
├── logo11.png              # Official corporate logo asset
├── IMFLogo.png             # International Maritime Federation membership emblem
├── maccia.jpg              # MACCIA accreditation emblem
├── css/
│   └── style.css           # Modularized external stylesheet
├── js/
│   └── main.js             # Modularized interactive JavaScript
└── image/                  # Static web images & membership assets
    ├── logo11.png          # Corporate logo
    ├── crew-mobilization-bulk-carrier-2026.webp # Crew mobilization portrait
    ├── gallery-*.*         # International delegations & events (PMO conference & dinner)
    ├── Capt-Ujjawal-Chaudhary.png # Managing Director portrait
    ├── maccia.jpg          # MACCIA accreditation badge
    └── IMFLogo.png         # International Maritime Federation badge
```

---

## Local development and application processing

The complete `/apply` workflow runs on **PHP 8.2+**, with a private PDO SQLite database and table-mapped DOCX generation from `NEW-APPLICATION-FORMAT-1.docx`. Production supports PHP-only Plesk hosting; Node is used only for development tests. The older Node prototype is not the deployment entry point.

Configure `APP_ENV`, `APPLICATION_PRIVATE_DIR`, `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` as described in the [setup and end-to-end testing guide](docs/application-setup.md). Private storage must be outside the web document root. There is no default staff password.

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
```

These are development checks, with isolated synthetic PHP integration tests. The vanilla website has no TypeScript compilation or asset bundling step. No new production package was added. The [setup guide](docs/application-setup.md) covers all changed files, the additive database migration, PHP extensions/environment, Linux Apache/nginx and Windows IIS routing, scheduled recovery, private backups, manual Word checks and remaining limitations. Server PDF generation is not included; completed DOCX files can be exported from Word.

For Plesk, upload the PHP/static deployment files identified in that guide, configure private storage and secrets separately, and enable HTTPS. Keep `.env`, database files, uploaded/generated dossiers, deployment ZIPs and diagnostic tools out of public access. Do not deploy `server.js`, Node dependencies or test artifacts. Verify the host OS and routing before deployment. A static-only server cannot process applications.

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
