/**
 * Sea & Seas Shipping Private Limited
 * Server-Side DOCX Auto-Generator from NEW APPLICATION FORMAT.docx
 * Accurately maps 100% of online form fields to exact table cells and paragraphs
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const TEMPLATE_PATHS = [
  path.join(__dirname, '..', 'NEW APPLICATION FORMAT.docx'),
  path.join(__dirname, '..', 'NEW-APPLICATION-FORMAT-1.docx'),
  path.join(process.env.HOME || '', 'Downloads', 'NEW APPLICATION FORMAT (1).docx'),
  path.join(process.env.HOME || '', 'Downloads', 'NEW APPLICATION FORMAT.docx')
];

function getTemplatePath() {
  for (const p of TEMPLATE_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error('Template file NEW APPLICATION FORMAT.docx could not be located on server.');
}

/**
 * Safe text formatter
 */
function clean(val, defaultVal = '') {
  if (val === null || val === undefined) return defaultVal;
  const str = String(val).trim();
  return str || defaultVal;
}

/**
 * Format ISO date (YYYY-MM-DD) to DD-MMM-YYYY for official maritime certificates
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).trim();
  if (!cleanStr) return '';
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return cleanStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Set formatted text inside a table cell <w:tc>
 */
function setCellContent(cell, text, { bold = false, prefix = null, size = 18 } = {}) {
  if (!cell) return;
  const doc = cell.ownerDocument;
  const val = clean(text);
  const displayText = prefix ? `${prefix}${val}` : val;
  if (!displayText && !prefix) return;

  let p = cell.getElementsByTagName('w:p')[0];
  if (!p) {
    p = doc.createElement('w:p');
    cell.appendChild(p);
  }

  // Remove existing runs
  const existingRuns = Array.from(p.childNodes).filter(n => n.nodeName === 'w:r');
  existingRuns.forEach(r => p.removeChild(r));

  // Build new run
  const r = doc.createElement('w:r');
  const rPr = doc.createElement('w:rPr');

  const rFonts = doc.createElement('w:rFonts');
  rFonts.setAttribute('w:ascii', 'Arial Narrow');
  rFonts.setAttribute('w:hAnsi', 'Arial Narrow');
  rFonts.setAttribute('w:cs', 'Arial Narrow');
  rPr.appendChild(rFonts);

  const sz = doc.createElement('w:sz');
  sz.setAttribute('w:val', String(size));
  rPr.appendChild(sz);

  if (bold) {
    const b = doc.createElement('w:b');
    rPr.appendChild(b);
  }

  r.appendChild(rPr);

  const t = doc.createElement('w:t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = displayText;
  r.appendChild(t);

  p.appendChild(r);
}

/**
 * Helper to get a table's rows and cells cleanly
 */
function getTableMatrix(table) {
  const rows = Array.from(table.childNodes).filter(n => n.nodeName === 'w:tr');
  return rows.map(r => Array.from(r.childNodes).filter(n => n.nodeName === 'w:tc'));
}

/**
 * Generate completed application DOCX from submitted form data
 */
async function generateApplicationDocx(formData, refNumber, outputDir) {
  const templatePath = getTemplatePath();
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  const xmlContent = await zip.file('word/document.xml').async('text');
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
  const tables = doc.getElementsByTagName('w:tbl');

  if (tables.length < 12) {
    throw new Error(`Invalid template structure: expected 12 tables, found ${tables.length}`);
  }

  const m = [];
  for (let i = 0; i < tables.length; i++) {
    m.push(getTableMatrix(tables[i]));
  }

  // Normalize form data keys
  const d = { ...formData };

  // =========================================================================
  // TABLE 0: POSITION
  // =========================================================================
  if (m[0]) {
    // Row 1 (Index 1), Cell 1: Position Applied for
    setCellContent(m[0][1]?.[1], d.position_applied || d.rank, { bold: true });
    // Row 2, Cell 1: Accept Lower Rank (YES / NO)
    setCellContent(m[0][2]?.[1], d.accept_lower_rank || 'NO', { bold: true });
    // Row 3, Cell 0: Date of Availability
    setCellContent(m[0][3]?.[0], formatDate(d.date_availability), { prefix: 'Date of Availability: ', bold: true });
  }

  // =========================================================================
  // TABLE 1: PERSONAL DETAILS & FAMILY DETAILS
  // =========================================================================
  if (m[1]) {
    // Row 2 (Index 2), Cell 1: Full Name
    setCellContent(m[1][2]?.[1], clean(d.full_name).toUpperCase(), { bold: true });
    // Row 3: DOB, POB, Nationality
    setCellContent(m[1][3]?.[0], formatDate(d.dob), { prefix: 'Date of Birth: ', bold: true });
    setCellContent(m[1][3]?.[1], clean(d.pob), { prefix: 'Place of Birth: ' });
    setCellContent(m[1][3]?.[3], clean(d.nationality, 'Indian'));

    // Permanent Address
    setCellContent(m[1][4]?.[1], clean(d.permanent_address));
    setCellContent(m[1][6]?.[2], clean(d.permanent_postcode));
    setCellContent(m[1][6]?.[4], clean(d.permanent_phone));

    // Email & Mobile Phone
    setCellContent(m[1][7]?.[1], clean(d.email));
    setCellContent(m[1][7]?.[3], clean(d.phone));

    // Present Address
    const presAddr = clean(d.present_address) || clean(d.permanent_address);
    setCellContent(m[1][8]?.[1], presAddr);
    setCellContent(m[1][10]?.[2], clean(d.present_postcode) || clean(d.permanent_postcode));
    setCellContent(m[1][10]?.[4], clean(d.present_phone) || clean(d.phone));

    // Nearest Airport & Marital Status
    setCellContent(m[1][11]?.[1], clean(d.nearest_airport));
    setCellContent(m[1][12]?.[1], clean(d.marital_status, 'Married'));

    // Height & Weight
    setCellContent(m[1][13]?.[1], clean(d.height_cm));
    setCellContent(m[1][13]?.[5], clean(d.weight_kg));

    // Boiler Suit Size & Shoe Size
    setCellContent(m[1][14]?.[0], clean(d.boiler_suit_size), { prefix: 'Boiler Suit Size : ' });
    setCellContent(m[1][14]?.[1], clean(d.shoe_size), { prefix: 'Shoe Size : ' });

    // Next of Kin
    setCellContent(m[1][16]?.[1], clean(d.kin_name), { bold: true });
    setCellContent(m[1][16]?.[3], clean(d.kin_relationship));
    setCellContent(m[1][17]?.[1], clean(d.kin_address));
    setCellContent(m[1][18]?.[3], clean(d.kin_postcode));
    setCellContent(m[1][19]?.[2], clean(d.kin_phone_primary) || clean(d.phone));
    setCellContent(m[1][19]?.[4], clean(d.kin_phone_secondary));

    // Family Data (Rows 22 to 25: Wife & Children)
    let familyList = [];
    if (d.family_json) {
      try {
        familyList = typeof d.family_json === 'string' ? JSON.parse(d.family_json) : d.family_json;
      } catch (e) {
        familyList = [];
      }
    }

    // Identify wife entry if present in familyList, otherwise fallback to flat fields
    const wifeEntry = familyList.find(f => (f.fam_rel || '').toLowerCase().includes('wife')) || {};
    const childEntries = familyList.filter(f => !(f.fam_rel || '').toLowerCase().includes('wife'));

    // Wife (Row 22)
    setCellContent(m[1][22]?.[1], clean(wifeEntry.fam_name || d.fam_name_wife || d.fam_name_1));
    setCellContent(m[1][22]?.[2], formatDate(wifeEntry.fam_anniv || d.fam_anniv_wife || d.fam_anniv_1));
    setCellContent(m[1][22]?.[3], formatDate(wifeEntry.fam_dob || d.fam_dob_wife || d.fam_dob_1));
    setCellContent(m[1][22]?.[4], clean(wifeEntry.fam_ppt || d.fam_ppt_wife || d.fam_ppt_1));
    setCellContent(m[1][22]?.[5], formatDate(wifeEntry.fam_doi || d.fam_doi_wife || d.fam_doi_1));
    setCellContent(m[1][22]?.[6], clean(wifeEntry.fam_poi || d.fam_poi_wife || d.fam_poi_1));
    setCellContent(m[1][22]?.[7], formatDate(wifeEntry.fam_doe || d.fam_doe_wife || d.fam_doe_1));
    setCellContent(m[1][22]?.[8], clean(wifeEntry.fam_ecnr || d.fam_ecnr_wife || d.fam_ecnr_1, 'YES'));

    // Child 1 (Row 23)
    const c1 = childEntries[0] || {};
    setCellContent(m[1][23]?.[1], clean(c1.fam_name || d.fam_name_c1 || d.fam_name_2));
    setCellContent(m[1][23]?.[2], formatDate(c1.fam_anniv || d.fam_anniv_c1 || d.fam_anniv_2));
    setCellContent(m[1][23]?.[3], formatDate(c1.fam_dob || d.fam_dob_c1 || d.fam_dob_2));
    setCellContent(m[1][23]?.[4], clean(c1.fam_ppt || d.fam_ppt_c1 || d.fam_ppt_2));
    setCellContent(m[1][23]?.[5], formatDate(c1.fam_doi || d.fam_doi_c1 || d.fam_doi_2));
    setCellContent(m[1][23]?.[6], clean(c1.fam_poi || d.fam_poi_c1 || d.fam_poi_2));
    setCellContent(m[1][23]?.[7], formatDate(c1.fam_doe || d.fam_doe_c1 || d.fam_doe_2));
    setCellContent(m[1][23]?.[8], clean(c1.fam_ecnr || d.fam_ecnr_c1 || d.fam_ecnr_2, 'YES'));

    // Child 2 (Row 24)
    const c2 = childEntries[1] || {};
    setCellContent(m[1][24]?.[1], clean(c2.fam_name || d.fam_name_c2 || d.fam_name_3));
    setCellContent(m[1][24]?.[2], formatDate(c2.fam_anniv || d.fam_anniv_c2 || d.fam_anniv_3));
    setCellContent(m[1][24]?.[3], formatDate(c2.fam_dob || d.fam_dob_c2 || d.fam_dob_3));
    setCellContent(m[1][24]?.[4], clean(c2.fam_ppt || d.fam_ppt_c2 || d.fam_ppt_3));
    setCellContent(m[1][24]?.[5], formatDate(c2.fam_doi || d.fam_doi_c2 || d.fam_doi_3));
    setCellContent(m[1][24]?.[6], clean(c2.fam_poi || d.fam_poi_c2 || d.fam_poi_3));
    setCellContent(m[1][24]?.[7], formatDate(c2.fam_doe || d.fam_doe_c2 || d.fam_doe_3));
    setCellContent(m[1][24]?.[8], clean(c2.fam_ecnr || d.fam_ecnr_c2 || d.fam_ecnr_3, 'YES'));

    // Child 3 (Row 25)
    const c3 = childEntries[2] || {};
    setCellContent(m[1][25]?.[1], clean(c3.fam_name || d.fam_name_c3 || d.fam_name_4));
    setCellContent(m[1][25]?.[2], formatDate(c3.fam_anniv || d.fam_anniv_c3 || d.fam_anniv_4));
    setCellContent(m[1][25]?.[3], formatDate(c3.fam_dob || d.fam_dob_c3 || d.fam_dob_4));
    setCellContent(m[1][25]?.[4], clean(c3.fam_ppt || d.fam_ppt_c3 || d.fam_ppt_4));
    setCellContent(m[1][25]?.[5], formatDate(c3.fam_doi || d.fam_doi_c3 || d.fam_doi_4));
    setCellContent(m[1][25]?.[6], clean(c3.fam_poi || d.fam_poi_c3 || d.fam_poi_4));
    setCellContent(m[1][25]?.[7], formatDate(c3.fam_doe || d.fam_doe_c3 || d.fam_doe_4));
    setCellContent(m[1][25]?.[8], clean(c3.fam_ecnr || d.fam_ecnr_c3 || d.fam_ecnr_4, 'YES'));
  }

  // =========================================================================
  // TABLE 2: MEDICAL HISTORY
  // =========================================================================
  if (m[2]) {
    // (a) Signed off due to medical reasons?
    const medSignoff = clean(d.medical_signoff, 'No');
    setCellContent(m[2][1]?.[1], medSignoff, { bold: true });
    if (medSignoff.toLowerCase() === 'yes') {
      setCellContent(m[2][2]?.[0], clean(d.med_vessel_name), { prefix: 'Name of the Vessel: ', bold: true });
      setCellContent(m[2][2]?.[1], formatDate(d.med_occurrence_date), { prefix: 'Date of Occurrence: ', bold: true });
      setCellContent(m[2][5]?.[0], clean(d.med_description), { prefix: 'Brief description of Illness / Injury / Accident: ' });
    } else {
      setCellContent(m[2][2]?.[0], 'None', { prefix: 'Name of the Vessel: ' });
      setCellContent(m[2][2]?.[1], 'None', { prefix: 'Date of Occurrence: ' });
      setCellContent(m[2][5]?.[0], 'None', { prefix: 'Brief description of Illness / Injury / Accident: ' });
    }

    // (b) Disease likely to render unfit
    setCellContent(m[2][6]?.[1], clean(d.medical_unfit_disease, 'No'), { bold: true });
    // (c) Addicted to alcohol or drugs
    setCellContent(m[2][7]?.[1], clean(d.medical_addiction, 'No'), { bold: true });

    // (d) Suffered from specific diseases
    setCellContent(m[2][10]?.[0], clean(d.med_malaria, 'No'));
    setCellContent(m[2][10]?.[1], clean(d.med_diabetes, 'No'));
    setCellContent(m[2][10]?.[2], clean(d.med_epilepsy, 'No'));
    setCellContent(m[2][10]?.[3], clean(d.med_nervous, 'No'));
    setCellContent(m[2][10]?.[4], clean(d.med_hepatitis, 'No'));

    // (e) Psychiatric treatment
    setCellContent(m[2][11]?.[1], clean(d.medical_psychiatric, 'No'), { bold: true });
  }

  // =========================================================================
  // TABLE 3: TRAVEL DOCUMENTS & VISA
  // =========================================================================
  if (m[3]) {
    // Row 2: Passport
    setCellContent(m[3][2]?.[0], clean(d.passport_no));
    setCellContent(m[3][2]?.[1], formatDate(d.passport_doi));
    setCellContent(m[3][2]?.[2], clean(d.passport_poi));
    setCellContent(m[3][2]?.[3], formatDate(d.passport_doe));
    setCellContent(m[3][2]?.[4], clean(d.passport_ecnr, 'YES'));
    setCellContent(m[3][2]?.[5], clean(d.passport_blank_pages, '10+'));

    // Row 4: US Visa & MUI
    setCellContent(m[3][4]?.[0], clean(d.us_visa_type || d.us_visa_no));
    setCellContent(m[3][4]?.[1], formatDate(d.us_visa_doi));
    setCellContent(m[3][4]?.[2], clean(d.us_visa_poi));
    setCellContent(m[3][4]?.[3], formatDate(d.us_visa_doe));
    setCellContent(m[3][4]?.[5], clean(d.mui_membership_no));
    setCellContent(m[3][4]?.[6], formatDate(d.mui_doe));

    // Rows 6 & 7: Other Visas
    setCellContent(m[3][6]?.[0], clean(d.other_visa_1 || d.other_visa_details));
    setCellContent(m[3][6]?.[1], formatDate(d.other_visa_1_doi));
    setCellContent(m[3][6]?.[2], clean(d.other_visa_1_poi));
    setCellContent(m[3][6]?.[3], formatDate(d.other_visa_1_doe));

    setCellContent(m[3][7]?.[0], clean(d.other_visa_2));
    setCellContent(m[3][7]?.[1], formatDate(d.other_visa_2_doi));
    setCellContent(m[3][7]?.[2], clean(d.other_visa_2_poi));
    setCellContent(m[3][7]?.[3], formatDate(d.other_visa_2_doe));
  }

  // =========================================================================
  // TABLE 4: ACADEMICS & PROFESSIONAL QUALIFICATIONS
  // =========================================================================
  if (m[4]) {
    // Educational Background (Rows 3 to 5)
    let eduList = [];
    if (d.education_json) {
      try {
        eduList = typeof d.education_json === 'string' ? JSON.parse(d.education_json) : d.education_json;
      } catch (e) {
        eduList = [];
      }
    }

    const ed1 = eduList[0] || {};
    const ed2 = eduList[1] || {};
    const ed3 = eduList[2] || {};

    setCellContent(m[4][3]?.[0], clean(ed1.edu_school || d.edu_school_1));
    setCellContent(m[4][3]?.[1], formatDate(ed1.edu_from || d.edu_from_1));
    setCellContent(m[4][3]?.[2], formatDate(ed1.edu_to || d.edu_to_1));
    setCellContent(m[4][3]?.[3], clean(ed1.edu_degree || d.edu_degree_1));

    setCellContent(m[4][4]?.[0], clean(ed2.edu_school || d.edu_school_2));
    setCellContent(m[4][4]?.[1], formatDate(ed2.edu_from || d.edu_from_2));
    setCellContent(m[4][4]?.[2], formatDate(ed2.edu_to || d.edu_to_2));
    setCellContent(m[4][4]?.[3], clean(ed2.edu_degree || d.edu_degree_2));

    setCellContent(m[4][5]?.[0], clean(ed3.edu_school || d.edu_school_3));
    setCellContent(m[4][5]?.[1], formatDate(ed3.edu_from || d.edu_from_3));
    setCellContent(m[4][5]?.[2], formatDate(ed3.edu_to || d.edu_to_3));
    setCellContent(m[4][5]?.[3], clean(ed3.edu_degree || d.edu_degree_3));

    // Pre-Sea Training (Row 8)
    setCellContent(m[4][8]?.[0], clean(d.presea_institute));
    setCellContent(m[4][8]?.[1], formatDate(d.presea_from));
    setCellContent(m[4][8]?.[2], formatDate(d.presea_to));
    setCellContent(m[4][8]?.[3], clean(d.presea_grade));
    setCellContent(m[4][8]?.[4], clean(d.presea_degree));

    // DNS / HND / TME (Rows 11 to 13)
    setCellContent(m[4][11]?.[0], clean(d.cadet_institute));
    setCellContent(m[4][11]?.[1], formatDate(d.cadet_from));
    setCellContent(m[4][11]?.[2], formatDate(d.cadet_to));
    setCellContent(m[4][11]?.[3], clean(d.cadet_grade));
    setCellContent(m[4][11]?.[4], clean(d.cadet_degree));
  }

  // =========================================================================
  // TABLE 5: CERTIFICATIONS & COURSES (CDC, INDOS, LICENSES, TANKER, DCE, INDIAN)
  // =========================================================================
  if (m[5]) {
    // 1. CDC Details (Rows 3 to 12)
    const cdcList = [
      { row: 3, pfx: 'cdc_indian' },
      { row: 4, pfx: 'cdc_honduras' },
      { row: 5, pfx: 'cdc_cook' },
      { row: 6, pfx: 'cdc_liberian' },
      { row: 7, pfx: 'cdc_panama' },
      { row: 8, pfx: 'cdc_bahamas' },
      { row: 9, pfx: 'cdc_belize' },
      { row: 10, pfx: 'cdc_vanuatu' },
      { row: 11, pfx: 'cdc_palau' },
      { row: 12, pfx: 'cdc_other' }
    ];
    cdcList.forEach(({ row, pfx }) => {
      setCellContent(m[5][row]?.[1], clean(d[`${pfx}_no`]));
      setCellContent(m[5][row]?.[2], formatDate(d[`${pfx}_doi`]));
      setCellContent(m[5][row]?.[3], formatDate(d[`${pfx}_doe`]));
      setCellContent(m[5][row]?.[4], clean(d[`${pfx}_poi`]));
    });

    // 2. INDOS Details (Row 14, Cell 1)
    setCellContent(m[5][14]?.[1], clean(d.indos_number), { bold: true });

    // 3. LICENSES (Rows 17 to 22)
    const licList = [
      { row: 17, pfx: 'coc_indian' },
      { row: 18, pfx: 'coc_honduras' },
      { row: 19, pfx: 'coc_uk' },
      { row: 20, pfx: 'coc_panama' },
      { row: 21, pfx: 'coc_cook' },
      { row: 22, pfx: 'coc_other' }
    ];
    licList.forEach(({ row, pfx }) => {
      setCellContent(m[5][row]?.[1], clean(d[`${pfx}_rank`] || d.position_applied));
      setCellContent(m[5][row]?.[2], clean(d[`${pfx}_no`]));
      setCellContent(m[5][row]?.[3], formatDate(d[`${pfx}_doi`]));
      setCellContent(m[5][row]?.[4], formatDate(d[`${pfx}_doe`]));
      setCellContent(m[5][row]?.[5], clean(d[`${pfx}_poi`]));
    });

    // 4. TANKER FAMILIARIZATION COURSES (Rows 25 to 30)
    const tankerList = [
      { row: 25, pfx: 'cert_otfc' },
      { row: 26, pfx: 'cert_ctfc' },
      { row: 27, pfx: 'cert_lgtc' },
      { row: 28, pfx: 'cert_tasco' },
      { row: 29, pfx: 'cert_chemco' },
      { row: 30, pfx: 'cert_gasco' }
    ];
    tankerList.forEach(({ row, pfx }) => {
      setCellContent(m[5][row]?.[1], clean(d[`${pfx}_no`]));
      setCellContent(m[5][row]?.[2], formatDate(d[`${pfx}_doi`]));
      setCellContent(m[5][row]?.[3], formatDate(d[`${pfx}_doe`]));
      setCellContent(m[5][row]?.[4], clean(d[`${pfx}_by`]));
    });

    // 5. DANGEROUS CARGO ENDORSEMENTS (Rows 33 to 35)
    const dceList = [
      { row: 33, pfx: 'dce_oil' },
      { row: 34, pfx: 'dce_chem' },
      { row: 35, pfx: 'dce_gas' }
    ];
    dceList.forEach(({ row, pfx }) => {
      setCellContent(m[5][row]?.[1], clean(d[`${pfx}_level`], 'Level II'));
      setCellContent(m[5][row]?.[2], clean(d[`${pfx}_no`]));
      setCellContent(m[5][row]?.[3], formatDate(d[`${pfx}_doi`]));
      setCellContent(m[5][row]?.[4], formatDate(d[`${pfx}_doe`]));
      setCellContent(m[5][row]?.[5], clean(d[`${pfx}_by`]));
    });

    // 6. INDIAN COURSES & CERTIFICATES (Rows 38 to 64)
    const indianCerts = [
      { row: 38, key: 'pssr' },
      { row: 39, key: 'pst' },
      { row: 40, key: 'fpff' },
      { row: 41, key: 'efa' },
      { row: 42, key: 'stsdsd' },
      { row: 43, key: 'ref_pssr' },
      { row: 44, key: 'ref_pst' },
      { row: 45, key: 'ref_fpff' },
      { row: 46, key: 'ref_efa' },
      { row: 47, key: 'ref_stsdsd' },
      { row: 48, key: 'pscrb' },
      { row: 49, key: 'pssr_amend' },
      { row: 50, key: 'aff' },
      { row: 51, key: 'mfa' },
      { row: 52, key: 'watchkeeping' },
      { row: 53, key: 'ab_deck' },
      { row: 54, key: 'ab_eng' },
      { row: 55, key: 'cook' },
      { row: 56, key: 'welder' },
      { row: 57, key: 'fitter' },
      { row: 58, key: 'eto' },
      { row: 59, key: 'yf' },
      { row: 60, key: 'bosiet' },
      { row: 61, key: 'opito' },
      { row: 62, key: 'h2s' },
      { row: 63, key: 'huet' },
      { row: 64, key: 'other' }
    ];
    indianCerts.forEach(({ row, key }) => {
      const pfx = `stcw_${key}`;
      setCellContent(m[5][row]?.[1], clean(d[`${pfx}_no`]));
      setCellContent(m[5][row]?.[2], formatDate(d[`${pfx}_doi`]));
      setCellContent(m[5][row]?.[3], formatDate(d[`${pfx}_doe`]));
      setCellContent(m[5][row]?.[4], clean(d[`${pfx}_by`]));
    });
  }

  // =========================================================================
  // TABLE 6: OTHER FLAG COURSES & CERTIFICATES (Rows 2 to 27)
  // =========================================================================
  if (m[6]) {
    const otherFlags = [
      { row: 2, key: 'basic' },
      { row: 3, key: 'stsdsd' },
      { row: 4, key: 'pscrb' },
      { row: 5, key: 'frb' },
      { row: 6, key: 'aff' },
      { row: 7, key: 'mfa' },
      { row: 8, key: 'gmdss' },
      { row: 9, key: 'sso' },
      { row: 10, key: 'lrtm' },
      { row: 11, key: 'mea' },
      { row: 12, key: 'arpa' },
      { row: 13, key: 'radar' },
      { row: 14, key: 'ecdis' },
      { row: 15, key: 'isps' },
      { row: 16, key: 'brm' },
      { row: 17, key: 'btm' },
      { row: 18, key: 'ers' },
      { row: 19, key: 'erm' },
      { row: 20, key: 'lchs' },
      { row: 21, key: 'medcare' },
      { row: 22, key: 'sat' },
      { row: 23, key: 'hv' },
      { row: 24, key: 'nav_watch' },
      { row: 25, key: 'eng_watch' },
      { row: 26, key: 'ab_deck' },
      { row: 27, key: 'ab_eng' }
    ];
    otherFlags.forEach(({ row, key }) => {
      const pfx = `other_${key}`;
      setCellContent(m[6][row]?.[1], clean(d[`${pfx}_no`]));
      setCellContent(m[6][row]?.[2], formatDate(d[`${pfx}_doi`]));
      setCellContent(m[6][row]?.[3], formatDate(d[`${pfx}_doe`]));
      setCellContent(m[6][row]?.[4], clean(d[`${pfx}_by`]));
    });
  }

  // =========================================================================
  // TABLE 7: PREVIOUS SEA SERVICE (Up to 10 Vessels: Rows 3 to 12)
  // =========================================================================
  if (m[7]) {
    let seaServiceList = [];
    if (d.sea_service_json) {
      try {
        seaServiceList = typeof d.sea_service_json === 'string' ? JSON.parse(d.sea_service_json) : d.sea_service_json;
      } catch (err) {
        seaServiceList = [];
      }
    }

    for (let i = 0; i < 10; i++) {
      const targetRow = 3 + i;
      const s = seaServiceList[i] || {};
      const num = i + 1;

      // Also check flat field fallbacks: sea_owner_1, sea_vessel_1, etc.
      const owner = clean(s.sea_owner || d[`sea_owner_${num}`]);
      const vessel = clean(s.sea_vessel || d[`sea_vessel_${num}`]);
      const built = clean(s.sea_built || d[`sea_built_${num}`]);
      const type = clean(s.sea_type || d[`sea_type_${num}`]);
      const grt = clean(s.sea_grt || d[`sea_grt_${num}`]);
      const dwt = clean(s.sea_dwt || d[`sea_dwt_${num}`]);
      const engine = clean(s.sea_engine || d[`sea_engine_${num}`]);
      const bhp = clean(s.sea_bhp || d[`sea_bhp_${num}`]);
      const rank = clean(s.sea_rank || d[`sea_rank_${num}`]);
      const from = formatDate(s.sea_from || d[`sea_from_${num}`]);
      const to = formatDate(s.sea_to || d[`sea_to_${num}`]);
      const total = clean(s.sea_total || d[`sea_total_${num}`]);
      const reason = clean(s.sea_reason || d[`sea_reason_${num}`]);

      if (vessel || owner) {
        setCellContent(m[7][targetRow]?.[1], owner);
        setCellContent(m[7][targetRow]?.[2], vessel, { bold: true });
        setCellContent(m[7][targetRow]?.[3], built);
        setCellContent(m[7][targetRow]?.[4], type);
        setCellContent(m[7][targetRow]?.[5], grt);
        setCellContent(m[7][targetRow]?.[6], dwt);
        setCellContent(m[7][targetRow]?.[7], engine);
        setCellContent(m[7][targetRow]?.[8], bhp);
        setCellContent(m[7][targetRow]?.[9], rank, { bold: true });
        setCellContent(m[7][targetRow]?.[10], from);
        setCellContent(m[7][targetRow]?.[11], to);
        setCellContent(m[7][targetRow]?.[12], total);
        setCellContent(m[7][targetRow]?.[13], reason);
      }
    }
  }

  // =========================================================================
  // TABLE 8: MISCELLANEOUS & TECHNICAL EXPERIENCE
  // =========================================================================
  if (m[8]) {
    // 1. Deck Officers (Rows 2 to 5)
    setCellContent(m[8][2]?.[1], clean(d.deck_bulk_cargo));
    setCellContent(m[8][3]?.[1], clean(d.deck_product_cargo));
    setCellContent(m[8][4]?.[1], clean(d.deck_chemical_cargo));
    setCellContent(m[8][5]?.[1], clean(d.deck_tanker_pumps));

    // 2. Engineers (Rows 7 to 9)
    setCellContent(m[8][7]?.[1], clean(d.eng_automation_type));
    setCellContent(m[8][8]?.[1], clean(d.eng_cranes_type));
    setCellContent(m[8][9]?.[1], clean(d.eng_grabs_type));

    // 3. Electrical Officers (Rows 11 to 14)
    setCellContent(m[8][11]?.[1], clean(d.eto_automation_type));
    setCellContent(m[8][12]?.[1], clean(d.eto_nor_system));
    setCellContent(m[8][13]?.[1], clean(d.eto_hydraulics_type));
    setCellContent(m[8][14]?.[1], clean(d.eto_plc_type));

    // 4. General Trading Area (Row 16)
    setCellContent(m[8][16]?.[0], clean(d.trading_areas, 'Worldwide'));

    // 5. Oil Major Inspections (Rows 18 to 20)
    setCellContent(m[8][18]?.[1], clean(d.cdi_details));
    setCellContent(m[8][18]?.[2], clean(d.cdi_inspection, 'No'));
    setCellContent(m[8][19]?.[1], clean(d.psc_inspections));
    setCellContent(m[8][20]?.[1], clean(d.oil_major_inspections));

    // 6. Dry Docking Experience (Rows 22 to 24)
    setCellContent(m[8][22]?.[0], clean(d.drydock_vessel_1 || d.drydock_experience));
    setCellContent(m[8][22]?.[1], clean(d.drydock_nature_1));
    setCellContent(m[8][23]?.[0], clean(d.drydock_vessel_2));
    setCellContent(m[8][23]?.[1], clean(d.drydock_nature_2));
    setCellContent(m[8][24]?.[0], clean(d.drydock_vessel_3));
    setCellContent(m[8][24]?.[1], clean(d.drydock_nature_3));
  }

  // =========================================================================
  // TABLE 10: SAVINGS ACCOUNT
  // =========================================================================
  if (m[10]) {
    setCellContent(m[10][2]?.[2], clean(d.bank_post_salary || d.position_applied));
    setCellContent(m[10][3]?.[2], clean(d.bank_account_type, 'Savings Account'));
    setCellContent(m[10][4]?.[2], clean(d.bank_holder_name || d.full_name), { bold: true });
    setCellContent(m[10][5]?.[2], clean(d.bank_name));
    setCellContent(m[10][6]?.[2], clean(d.bank_account_no), { bold: true });
    setCellContent(m[10][7]?.[2], clean(d.bank_address));
    setCellContent(m[10][8]?.[2], clean(d.bank_ifsc), { bold: true });
    setCellContent(m[10][9]?.[2], formatDate(d.bank_date_joining));
  }

  // =========================================================================
  // TABLE 11: NRI ACCOUNT
  // =========================================================================
  if (m[11]) {
    setCellContent(m[11][2]?.[2], clean(d.nri_account_type, 'NRE / NRO'));
    setCellContent(m[11][3]?.[2], clean(d.nri_holder_name || d.full_name));
    setCellContent(m[11][4]?.[2], clean(d.nri_bank_name));
    setCellContent(m[11][5]?.[2], clean(d.nri_account_no));
    setCellContent(m[11][6]?.[2], clean(d.nri_bank_address));
    setCellContent(m[11][7]?.[2], clean(d.nri_ifsc_swift));
  }

  // =========================================================================
  // BODY PARAGRAPHS: WAGES, DECLARATIONS, AND SIGNATURES
  // =========================================================================
  const allParagraphs = doc.getElementsByTagName('w:p');
  const nowFormatted = formatDate(d.signature_date || new Date().toISOString());
  const signName = clean(d.digital_signature_name || d.full_name).toUpperCase();

  for (let pIdx = 0; pIdx < allParagraphs.length; pIdx++) {
    const p = allParagraphs[pIdx];
    const textNodes = p.getElementsByTagName('w:t');
    const pText = Array.from(textNodes).map(t => t.textContent).join('');

    // 1. Last Drawn Wages & Expected Wages Paragraph
    if (pText.includes('Last Drawn Wages:') && pText.includes('Expected Wages:')) {
      const lastWages = clean(d.last_drawn_wages, 'N/A');
      const expWages = clean(d.expected_wages, 'As per Company Scale');
      const newWageText = `Last Drawn Wages: ${lastWages}                                Expected Wages: ${expWages}`;

      // Set clean replacement
      Array.from(p.getElementsByTagName('w:r')).forEach(r => p.removeChild(r));
      const r = doc.createElement('w:r');
      const rPr = doc.createElement('w:rPr');
      const b = doc.createElement('w:b');
      rPr.appendChild(b);
      r.appendChild(rPr);
      const t = doc.createElement('w:t');
      t.setAttribute('xml:space', 'preserve');
      t.textContent = newWageText;
      r.appendChild(t);
      p.appendChild(r);
    }

    // 2. Signatures Paragraph
    if (pText.includes('FOR SEA & SEAS SHIPPING PRIVATE LIMITED') || pText.includes('SIGNED BY CREW')) {
      const sigLine = `RECEIVED BY: Sea & Seas Crewing Desk            DATED: ${nowFormatted}            SIGNED BY CREW: ${signName}`;
      Array.from(p.getElementsByTagName('w:r')).forEach(r => p.removeChild(r));
      const r = doc.createElement('w:r');
      const rPr = doc.createElement('w:rPr');
      const b = doc.createElement('w:b');
      rPr.appendChild(b);
      r.appendChild(rPr);
      const t = doc.createElement('w:t');
      t.setAttribute('xml:space', 'preserve');
      t.textContent = sigLine;
      r.appendChild(t);
      p.appendChild(r);
    }
  }

  // Serialize updated XML and repack ZIP
  const updatedXml = new XMLSerializer().serializeToString(doc);
  zip.file('word/document.xml', updatedXml);

  const cleanName = clean(d.full_name, 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
  const outFileName = `${refNumber}_Form_RPS-01A_${cleanName}.docx`;
  const outFilePath = path.join(outputDir, outFileName);

  const docxBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  fs.writeFileSync(outFilePath, docxBuffer);

  return {
    filename: outFileName,
    filePath: outFilePath,
    sizeBytes: docxBuffer.length
  };
}

module.exports = {
  generateApplicationDocx,
  formatDate
};
