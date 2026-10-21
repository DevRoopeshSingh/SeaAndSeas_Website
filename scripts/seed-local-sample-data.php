<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../includes/application_bootstrap.php';

$env = get_env_var('APP_ENV');
if ($env !== 'local') {
    fwrite(STDERR, "Error: Sample data seeding is only permitted in local development (APP_ENV=local).\n");
    exit(1);
}

$clean = in_array('--clean', $argv, true);

try {
    $db = app_db();
    $root = app_root();

    if ($clean) {
        $db->exec("DELETE FROM applications");
        $db->exec("DELETE FROM application_audit");
        echo "Cleaned existing applications and audit records.\n";
    }

    $templateDocx = __DIR__ . '/../NEW-APPLICATION-FORMAT-1.docx';
    $hasTemplate = is_file($templateDocx) && is_readable($templateDocx);

    // Minimal valid 1-page PDF stream generator
    function generate_sample_pdf(string $name, string $rank): string {
        $text = "Curriculum Vitae - " . $name . " (" . $rank . ")";
        $len = strlen($text);
        return "%PDF-1.4\n" .
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" .
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" .
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" .
            "4 0 obj\n<< /Length " . (60 + $len) . " >>\nstream\nBT\n/F1 16 Tf\n50 720 Td\n(" . addcslashes($text, "()\\") . ") Tj\nET\nendstream\nendobj\n" .
            "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n" .
            "0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000360 00000 n \n" .
            "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n440\n%%EOF\n";
    }

    $samples = [
        [
            'ref' => 'SS-APP-2026-4679',
            'full_name' => 'Capt. Rakesh Mohan Verma',
            'position_applied' => 'Master',
            'accept_lower_rank' => 'NO',
            'email' => 'rakesh.verma@example.com',
            'phone' => '+91 98200 55443',
            'indos_number' => '08NL2299',
            'cdc_indian_no' => 'MUM 142091',
            'passport_no' => 'Z4892104',
            'status' => 'shortlisted',
            'date_availability' => '2026-11-01',
            'dob' => '1982-04-15',
            'pob' => 'Mumbai, Maharashtra',
            'nationality' => 'Indian',
            'marital_status' => 'Married',
            'nearest_airport' => 'BOM - Chhatrapati Shivaji Maharaj International',
            'height_cm' => '178',
            'weight_kg' => '76',
            'boiler_suit_size' => 'L',
            'shoe_size' => '9',
            'permanent_address' => 'Flat 402, Sea Breeze Heights, Palm Beach Road, Sanpada, Navi Mumbai',
            'permanent_postcode' => '400705',
            'kin_name' => 'Sunita Verma',
            'kin_relationship' => 'Wife',
            'kin_phone_primary' => '+91 98200 55444',
            'kin_address' => 'Flat 402, Sea Breeze Heights, Palm Beach Road, Sanpada, Navi Mumbai',
            'passport_doe' => '2031-03-20',
            'coc_indian_no' => 'IND-COC-M-2012-99',
            'coc_indian_rank' => 'Master FG',
            'coc_panama_no' => 'PAN-M-88912',
            'last_drawn_wages' => 'USD 9,500/mo',
            'expected_wages' => 'USD 10,200/mo',
            'bank_name' => 'HDFC Bank',
            'bank_account_no' => '5010023948102',
            'bank_ifsc' => 'HDFC0000241',
            'trading_areas' => 'Worldwide (US East Coast, Far East, Persian Gulf)',
            'cdi_inspection' => 'Yes',
            'cdi_details' => 'Passed CDI with zero critical observations on Aframax Tanker (2025)',
            'oil_major_inspections' => 'SIRE 2.0 inspections passed: Chevron, Shell, BP',
            'drydock_experience' => 'Attended 2 Special Surveys as Master (Drydocks World Dubai & Tuas Singapore)',
            'sea_service' => [
                ['vessel_name' => 'MT Arabian Glory', 'vessel_type' => 'Aframax Tanker', 'rank' => 'Master', 'dwt' => '115,000', 'from' => '2025-02-10', 'to' => '2025-08-15', 'company' => 'Stolt Tankers'],
                ['vessel_name' => 'MT Pacific Wave', 'vessel_type' => 'Crude Oil Tanker', 'rank' => 'Chief Officer', 'dwt' => '105,000', 'from' => '2024-03-01', 'to' => '2024-09-20', 'company' => 'Teekay Marine'],
            ]
        ],
        [
            'ref' => 'SS-APP-2026-5120',
            'full_name' => 'Devendra Pratap Singh',
            'position_applied' => 'Chief Engineer',
            'accept_lower_rank' => 'NO',
            'email' => 'devendra.singh@example.com',
            'phone' => '+91 98311 44221',
            'indos_number' => '05EL3841',
            'cdc_indian_no' => 'KOL 99214',
            'passport_no' => 'P8391023',
            'status' => 'under_review',
            'date_availability' => 'Immediate',
            'dob' => '1984-09-12',
            'pob' => 'Kolkata, West Bengal',
            'nationality' => 'Indian',
            'marital_status' => 'Married',
            'nearest_airport' => 'CCU - Netaji Subhash Chandra Bose International',
            'height_cm' => '174',
            'weight_kg' => '72',
            'boiler_suit_size' => 'M',
            'shoe_size' => '8',
            'permanent_address' => '14B Lake Gardens, Southern Avenue, Kolkata',
            'permanent_postcode' => '700045',
            'kin_name' => 'Priyanka Singh',
            'kin_relationship' => 'Wife',
            'kin_phone_primary' => '+91 98311 44222',
            'kin_address' => '14B Lake Gardens, Southern Avenue, Kolkata',
            'passport_doe' => '2030-08-14',
            'coc_indian_no' => 'IND-COC-CE-2015-441',
            'coc_indian_rank' => 'Marine Engineer Officer Class 1',
            'coc_panama_no' => '',
            'last_drawn_wages' => 'USD 8,800/mo',
            'expected_wages' => 'USD 9,200/mo',
            'bank_name' => 'State Bank of India',
            'bank_account_no' => '30291049210',
            'bank_ifsc' => 'SBIN0001053',
            'trading_areas' => 'Worldwide (Trans-Pacific, Europe-Asia)',
            'cdi_inspection' => 'No',
            'cdi_details' => 'N/A',
            'oil_major_inspections' => 'ExxonMobil and Shell approved Chief Engineer',
            'drydock_experience' => 'Complete main engine overhaul (MAN B&W 6S60ME-C) during major docking in Batam',
            'sea_service' => [
                ['vessel_name' => 'MV Bengal Pioneer', 'vessel_type' => 'Capesize Bulk Carrier', 'rank' => 'Chief Engineer', 'dwt' => '180,000', 'from' => '2025-01-05', 'to' => '2025-07-10', 'company' => 'Oldendorff Carriers'],
            ]
        ],
        [
            'ref' => 'SS-APP-2026-6294',
            'full_name' => 'Amit Kumar Sharma',
            'position_applied' => 'Chief Officer',
            'accept_lower_rank' => 'NO',
            'email' => 'amit.sharma@example.com',
            'phone' => '+91 94440 12890',
            'indos_number' => '12NL8834',
            'cdc_indian_no' => 'CHE 55102',
            'passport_no' => 'M2019482',
            'status' => 'submitted',
            'date_availability' => '2026-11-15',
            'dob' => '1989-11-25',
            'pob' => 'Chennai, Tamil Nadu',
            'nationality' => 'Indian',
            'marital_status' => 'Married',
            'nearest_airport' => 'MAA - Chennai International Airport',
            'height_cm' => '172',
            'weight_kg' => '68',
            'boiler_suit_size' => 'M',
            'shoe_size' => '8',
            'permanent_address' => 'Plot 22, 4th Main Road, Anna Nagar West, Chennai',
            'permanent_postcode' => '600040',
            'kin_name' => 'Kavitha Sharma',
            'kin_relationship' => 'Wife',
            'kin_phone_primary' => '+91 94440 12891',
            'kin_address' => 'Plot 22, 4th Main Road, Anna Nagar West, Chennai',
            'passport_doe' => '2032-05-18',
            'coc_indian_no' => 'IND-COC-CO-2019-102',
            'coc_indian_rank' => 'Chief Mate FG',
            'coc_panama_no' => 'PAN-CO-44910',
            'last_drawn_wages' => 'USD 6,200/mo',
            'expected_wages' => 'USD 6,800/mo',
            'bank_name' => 'ICICI Bank',
            'bank_account_no' => '001201584920',
            'bank_ifsc' => 'ICIC0000012',
            'trading_areas' => 'Mediterranean, Red Sea, Arabian Gulf',
            'cdi_inspection' => 'Yes',
            'cdi_details' => 'Attended CDI as Chief Officer on Chemical Tanker Type II',
            'oil_major_inspections' => 'SIRE inspection experience with TotalEnergies and BP',
            'drydock_experience' => 'Tank coating and cargo pump overhauls in Tuzla shipyard',
            'sea_service' => [
                ['vessel_name' => 'MT Coromandel Star', 'vessel_type' => 'Product Tanker', 'rank' => 'Chief Officer', 'dwt' => '47,000', 'from' => '2025-03-01', 'to' => '2025-09-01', 'company' => 'Scorpio Tankers'],
            ]
        ],
        [
            'ref' => 'SS-APP-2026-7319',
            'full_name' => 'Rajesh Balakrishnan',
            'position_applied' => '2nd Engineer',
            'accept_lower_rank' => 'YES',
            'email' => 'r.balakrishnan@example.com',
            'phone' => '+91 94471 88203',
            'indos_number' => '14EL1190',
            'cdc_indian_no' => 'COCH 33819',
            'passport_no' => 'T6619021',
            'status' => 'submitted',
            'date_availability' => 'Immediate',
            'dob' => '1991-03-08',
            'pob' => 'Kochi, Kerala',
            'nationality' => 'Indian',
            'marital_status' => 'Single',
            'nearest_airport' => 'COK - Cochin International Airport',
            'height_cm' => '176',
            'weight_kg' => '74',
            'boiler_suit_size' => 'L',
            'shoe_size' => '9',
            'permanent_address' => 'Surabhi, Panampilly Nagar, Kochi, Kerala',
            'permanent_postcode' => '682036',
            'kin_name' => 'Balakrishnan Menon',
            'kin_relationship' => 'Father',
            'kin_phone_primary' => '+91 94471 88200',
            'kin_address' => 'Surabhi, Panampilly Nagar, Kochi, Kerala',
            'passport_doe' => '2033-10-12',
            'coc_indian_no' => 'IND-COC-2E-2021-88',
            'coc_indian_rank' => 'Marine Engineer Officer Class 2',
            'coc_panama_no' => '',
            'last_drawn_wages' => 'USD 4,800/mo',
            'expected_wages' => 'USD 5,200/mo',
            'bank_name' => 'Federal Bank',
            'bank_account_no' => '1029010048192',
            'bank_ifsc' => 'FDRL0001029',
            'trading_areas' => 'SE Asia, Indian Ocean, Persian Gulf',
            'cdi_inspection' => 'No',
            'cdi_details' => '',
            'oil_major_inspections' => 'Experienced with auxiliary boiler & purifier surveys',
            'drydock_experience' => 'Shaft withdrawal and stern tube seal replacement in Colombo Dockyard',
            'sea_service' => [
                ['vessel_name' => 'MV Malabar Trader', 'vessel_type' => 'Container Feeder', 'rank' => '2nd Engineer', 'dwt' => '28,000', 'from' => '2024-11-10', 'to' => '2025-05-15', 'company' => 'X-Press Feeders'],
            ]
        ],
        [
            'ref' => 'SS-APP-2026-8041',
            'full_name' => 'Vikas Suresh Patil',
            'position_applied' => '2nd Officer',
            'accept_lower_rank' => 'YES',
            'email' => 'vikas.patil@example.com',
            'phone' => '+91 98211 90284',
            'indos_number' => '18NL4921',
            'cdc_indian_no' => 'MUM 228941',
            'passport_no' => 'V9012384',
            'status' => 'under_review',
            'date_availability' => '2026-11-20',
            'dob' => '1994-07-19',
            'pob' => 'Alibaug, Maharashtra',
            'nationality' => 'Indian',
            'marital_status' => 'Single',
            'nearest_airport' => 'BOM - Chhatrapati Shivaji Maharaj International',
            'height_cm' => '170',
            'weight_kg' => '65',
            'boiler_suit_size' => 'M',
            'shoe_size' => '8',
            'permanent_address' => 'House No. 45, Rewas Road, Alibaug, Raigad, Maharashtra',
            'permanent_postcode' => '402201',
            'kin_name' => 'Suresh Patil',
            'kin_relationship' => 'Father',
            'kin_phone_primary' => '+91 98211 90280',
            'kin_address' => 'House No. 45, Rewas Road, Alibaug, Raigad, Maharashtra',
            'passport_doe' => '2034-01-15',
            'coc_indian_no' => 'IND-COC-2O-2022-310',
            'coc_indian_rank' => '2nd Mate FG',
            'coc_panama_no' => '',
            'last_drawn_wages' => 'USD 3,400/mo',
            'expected_wages' => 'USD 3,800/mo',
            'bank_name' => 'Axis Bank',
            'bank_account_no' => '918020048192019',
            'bank_ifsc' => 'UTIB0000182',
            'trading_areas' => 'Arabian Sea, Bay of Bengal, Straits of Malacca',
            'cdi_inspection' => 'No',
            'cdi_details' => '',
            'oil_major_inspections' => 'ECDIS Type Specific (Furuno & JRC), Passage Planning specialist',
            'drydock_experience' => 'Standard intermediate drydock hull maintenance',
            'sea_service' => [
                ['vessel_name' => 'MV Konkan Express', 'vessel_type' => 'General Cargo', 'rank' => '3rd Officer', 'dwt' => '18,500', 'from' => '2024-06-01', 'to' => '2025-01-15', 'company' => 'Greatship India'],
            ]
        ],
        [
            'ref' => 'SS-APP-2026-8812',
            'full_name' => 'Mohammed Farhan Khan',
            'position_applied' => 'Electro-Technical Officer (ETO)',
            'accept_lower_rank' => 'NO',
            'email' => 'farhan.khan@example.com',
            'phone' => '+91 98921 77319',
            'indos_number' => '16EL7732',
            'cdc_indian_no' => 'MUM 199342',
            'passport_no' => 'K4820194',
            'status' => 'shortlisted',
            'date_availability' => 'Immediate',
            'dob' => '1990-01-30',
            'pob' => 'Lucknow, Uttar Pradesh',
            'nationality' => 'Indian',
            'marital_status' => 'Married',
            'nearest_airport' => 'LKO - Chaudhary Charan Singh International',
            'height_cm' => '180',
            'weight_kg' => '78',
            'boiler_suit_size' => 'L',
            'shoe_size' => '10',
            'permanent_address' => 'Flat 301, Gulmarg Apartments, Gomti Nagar, Lucknow',
            'permanent_postcode' => '226010',
            'kin_name' => 'Ayesha Khan',
            'kin_relationship' => 'Wife',
            'kin_phone_primary' => '+91 98921 77320',
            'kin_address' => 'Flat 301, Gulmarg Apartments, Gomti Nagar, Lucknow',
            'passport_doe' => '2031-11-09',
            'coc_indian_no' => 'IND-COC-ETO-2018-051',
            'coc_indian_rank' => 'Electro-Technical Officer (STCW III/6)',
            'coc_panama_no' => '',
            'last_drawn_wages' => 'USD 4,500/mo',
            'expected_wages' => 'USD 4,900/mo',
            'bank_name' => 'Kotak Mahindra Bank',
            'bank_account_no' => '4810294819',
            'bank_ifsc' => 'KKBK0000142',
            'trading_areas' => 'Worldwide (LNG & Container routes)',
            'cdi_inspection' => 'No',
            'cdi_details' => '',
            'oil_major_inspections' => 'High Voltage Safety (HVS) certified, automation & PLC troubleshooting',
            'drydock_experience' => 'MSB overhaul, generator synchronizing and alarm monitoring calibration',
            'sea_service' => [
                ['vessel_name' => 'MV Pearl River', 'vessel_type' => 'Container (8500 TEU)', 'rank' => 'ETO', 'dwt' => '94,000', 'from' => '2024-08-01', 'to' => '2025-02-28', 'company' => 'CMA CGM'],
            ]
        ],
        [
            'ref' => 'SS-APP-2026-9204',
            'full_name' => 'Anthony D\'Souza',
            'position_applied' => 'Bosun',
            'accept_lower_rank' => 'NO',
            'email' => 'anthony.dsouza@example.com',
            'phone' => '+91 98221 44091',
            'indos_number' => '09DL4410',
            'cdc_indian_no' => 'GOA 08412',
            'passport_no' => 'G3391024',
            'status' => 'submitted',
            'date_availability' => 'Immediate',
            'dob' => '1986-06-14',
            'pob' => 'Margao, Goa',
            'nationality' => 'Indian',
            'marital_status' => 'Married',
            'nearest_airport' => 'GOI - Dabolim Airport Goa',
            'height_cm' => '168',
            'weight_kg' => '70',
            'boiler_suit_size' => 'M',
            'shoe_size' => '7',
            'permanent_address' => 'House 112/A, Borda, Margao, South Goa',
            'permanent_postcode' => '403602',
            'kin_name' => 'Maria D\'Souza',
            'kin_relationship' => 'Wife',
            'kin_phone_primary' => '+91 98221 44092',
            'kin_address' => 'House 112/A, Borda, Margao, South Goa',
            'passport_doe' => '2029-04-10',
            'coc_indian_no' => 'IND-COP-AB-2012-401',
            'coc_indian_rank' => 'Able Seafarer Deck (STCW II/5)',
            'coc_panama_no' => '',
            'last_drawn_wages' => 'USD 1,750/mo',
            'expected_wages' => 'USD 1,900/mo',
            'bank_name' => 'Bank of India',
            'bank_account_no' => '104920194819',
            'bank_ifsc' => 'BKID0001049',
            'trading_areas' => 'Mediterranean, West Africa',
            'cdi_inspection' => 'No',
            'cdi_details' => '',
            'oil_major_inspections' => 'Rigging, mooring operations and deck maintenance supervisor',
            'drydock_experience' => 'Hull blasting, painting and anchor chain calibration in Cadiz shipyard',
            'sea_service' => [
                ['vessel_name' => 'MV Atlantic Trader', 'vessel_type' => 'Handysize Bulk Carrier', 'rank' => 'Bosun', 'dwt' => '35,000', 'from' => '2024-04-10', 'to' => '2024-12-15', 'company' => 'Eagle Bulk'],
            ]
        ],
        [
            'ref' => 'SS-APP-2026-9750',
            'full_name' => 'Suresh Chandra Das',
            'position_applied' => 'Chief Cook',
            'accept_lower_rank' => 'NO',
            'email' => 'suresh.das@example.com',
            'phone' => '+91 98300 22910',
            'indos_number' => '11DL5581',
            'cdc_indian_no' => 'KOL 48102',
            'passport_no' => 'L8819203',
            'status' => 'rejected',
            'date_availability' => '2026-12-01',
            'dob' => '1987-12-05',
            'pob' => 'Bhubaneswar, Odisha',
            'nationality' => 'Indian',
            'marital_status' => 'Married',
            'nearest_airport' => 'BBI - Biju Patnaik International Airport',
            'height_cm' => '165',
            'weight_kg' => '68',
            'boiler_suit_size' => 'M',
            'shoe_size' => '7',
            'permanent_address' => 'Plot 88, Sahid Nagar, Bhubaneswar, Odisha',
            'permanent_postcode' => '751007',
            'kin_name' => 'Manju Das',
            'kin_relationship' => 'Wife',
            'kin_phone_primary' => '+91 98300 22911',
            'kin_address' => 'Plot 88, Sahid Nagar, Bhubaneswar, Odisha',
            'passport_doe' => '2028-09-17',
            'coc_indian_no' => 'IND-MLC-COOK-2014-99',
            'coc_indian_rank' => 'Ship Cook Certificate (MLC 2006)',
            'coc_panama_no' => '',
            'last_drawn_wages' => 'USD 1,600/mo',
            'expected_wages' => 'USD 1,800/mo',
            'bank_name' => 'Punjab National Bank',
            'bank_account_no' => '0491029481901',
            'bank_ifsc' => 'PUNB0049100',
            'trading_areas' => 'Far East, China coastal',
            'cdi_inspection' => 'No',
            'cdi_details' => '',
            'oil_major_inspections' => 'HACCP & food safety certified',
            'drydock_experience' => 'Galley deep-cleaning and cold storage overhaul',
            'sea_service' => [
                ['vessel_name' => 'MV Orient Pioneer', 'vessel_type' => 'Supramax Bulk Carrier', 'rank' => 'Chief Cook', 'dwt' => '56,000', 'from' => '2024-02-15', 'to' => '2024-10-20', 'company' => 'Pacific Basin'],
            ]
        ]
    ];

    $insertStmt = $db->prepare("
        INSERT OR REPLACE INTO applications (
            id, ref_number, full_name, position_applied, email, phone, indos_number,
            status, schema_version, data_json, idempotency_hash, payload_hash,
            cv_path, cv_name, cv_size, docx_path, submitted_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, 1, ?, ?, ?,
            ?, ?, ?, ?, ?, ?
        )
    ");

    $count = 0;
    foreach ($samples as $index => $item) {
        $id = md5($item['ref']);
        $folder = $root . '/files/' . $id;
        if (!is_dir($folder)) {
            mkdir($folder, 0700, true);
        }

        // 1. Docx file
        $docxRelative = 'files/' . $id . '/application.docx';
        $docxFull = $root . '/' . $docxRelative;
        if ($hasTemplate) {
            copy($templateDocx, $docxFull);
        } else {
            file_put_contents($docxFull, 'Sample Form RPS 01-A docx');
        }

        // 2. CV file
        $cvRelative = 'files/' . $id . '/cv.pdf';
        $cvFull = $root . '/' . $cvRelative;
        $cvContent = generate_sample_pdf($item['full_name'], $item['position_applied']);
        file_put_contents($cvFull, $cvContent);

        // 3. Raw Data JSON
        $dataJson = json_encode($item, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        $idempotencyHash = hash('sha256', 'seed-' . $item['ref']);
        $payloadHash = hash('sha256', $dataJson);

        $submittedAt = gmdate('c', strtotime('-' . ($index * 2 + 1) . ' days'));
        $updatedAt = gmdate('c', strtotime('-' . ($index * 1) . ' days'));

        $insertStmt->execute([
            $id,
            $item['ref'],
            $item['full_name'],
            $item['position_applied'],
            $item['email'],
            $item['phone'],
            $item['indos_number'],
            $item['status'],
            $dataJson,
            $idempotencyHash,
            $payloadHash,
            $cvRelative,
            preg_replace('/[^a-zA-Z0-9_-]/', '_', $item['full_name']) . '_CV.pdf',
            strlen($cvContent),
            $docxRelative,
            $submittedAt,
            $updatedAt
        ]);

        app_audit($db, $id, 'sample_seeded', 'cli_seed');
        $count++;
    }

    echo "✅ Successfully seeded {$count} sample seafarer applications into local SQLite database!\n";
    echo "Database: {$root}/applications.sqlite\n";
    echo "\nSummary of Seeded Applications:\n";
    echo str_repeat('-', 80) . "\n";
    printf("%-18s | %-24s | %-16s | %-12s\n", "Ref Number", "Full Name", "Rank", "Status");
    echo str_repeat('-', 80) . "\n";
    foreach ($samples as $s) {
        printf("%-18s | %-24s | %-16s | %-12s\n", $s['ref'], $s['full_name'], $s['position_applied'], $s['status']);
    }
    echo str_repeat('-', 80) . "\n";
    echo "\nOpen http://localhost:8000/admin (or http://127.0.0.1:8000/admin) to view the roster.\n";

} catch (Throwable $e) {
    fwrite(STDERR, "❌ Seeding failed: " . $e->getMessage() . "\n");
    exit(1);
}
