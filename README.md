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
* **Quick Contact & Direct WhatsApp Integration**: Floating pulse WhatsApp widget with direct message deep-linking to crewing desks in India and the UAE.
* **SEO & Social Sharing Ready**:
  * Full OpenGraph and Twitter Card metadata.
  * Schema.org `Corporation` JSON-LD structured data with dual-location address mapping.

---

## 📂 Project Structure

```text
SeaAndSeas_Website/
├── .gitignore              # Ignores OS metadata and deployment archives
├── README.md               # Project documentation
├── index.html              # Main production landing page
├── SeaAndSeas_Website.html # Source HTML mirror
├── website.html            # Source HTML mirror
├── hero-ship.jpg           # High-resolution hero vessel photography
├── logo11.png              # Official corporate logo asset
├── IMFLogo.png             # International Maritime Federation membership emblem
├── maccia.jpg              # MACCIA accreditation emblem
└── image/
    └── logo11.png          # Asset directory for OpenGraph & Schema logo resolution
```

---

## 🚀 Local Development

Because this is a pure static web application, no compilation or build steps (`npm install` / `npm run build`) are needed.

### Running Locally:
You can preview the website by opening `index.html` directly in any web browser, or via a local lightweight server:

#### Using Python:
```bash
# Python 3
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

#### Using Node (`npx serve` or `live-server`):
```bash
npx serve .
```

#### Using VS Code / IDE:
Right-click on `index.html` and choose **Open with Live Server**.

---

## 🌐 Deployment Guide (Plesk Obsidian)

This website is **100% compatible with shared hosting** on Plesk Obsidian without needing Node.js or database daemons.

### Step 1: Create Backup of Current Live Site
1. Log in to your **Plesk Obsidian** panel.
2. Go to **Websites & Domains** > `seasshipping.com` > **File Manager**.
3. Inside `httpdocs/`, select all existing files and click **Add to Archive** (e.g. `backup_live_seasshipping.zip`).
4. Download the backup `.zip` to your local storage for safekeeping.

### Step 2: Upload Files
1. Use the pre-built `deploy_seasshipping.zip` archive or zip the project files:
   ```bash
   zip -r deploy_seasshipping.zip index.html hero-ship.jpg logo11.png IMFLogo.png maccia.jpg image/ -x "*.DS_Store*"
   ```
2. In Plesk **File Manager**, enter `httpdocs/` and click **Upload**.
3. Select `deploy_seasshipping.zip`, click **Extract Files**, and verify that `index.html` is placed directly in `httpdocs/`.

### Step 3: Server Configuration
* **Default Document**: Ensure `index.html` is at the top of the **Index Files / Default Documents** list in Plesk.
* **Gzip Compression**: Ensure Gzip/Brotli compression is enabled under **Apache & nginx Settings** for maximum delivery speed.
* **SSL / HTTPS**: In **Hosting Settings**, check **Permanent SEO-safe 301 redirect from HTTP to HTTPS** with your active Let's Encrypt SSL certificate.

---

## 🏢 Corporate Contact Information

* **India Headquarters**:
  * **Address**: 410, 4th Floor, Concorde Building, Plot No. 66A, Sector-11, C.B.D. Belapur, Navi Mumbai, Maharashtra 400614, India.
  * **Phone**: +91-22-49246060 / +91-22-49673720
  * **Email**: `crewing@seasshipping.com` | `operations@seasshipping.com`
* **UAE Operations**:
  * **Address**: Port Area, Serving Ajman, Sharjah Khalid & Hamriyah Ports, United Arab Emirates.
  * **Email**: `uae@seasshipping.com`

---

## 📄 License & Copyright

© 2008–2026 **Sea & Seas Shipping Private Limited**. All rights reserved.  
ISO 9001:2015 Certified | STCW 2010 | MLC 2006 | RPS Rules 2005.
