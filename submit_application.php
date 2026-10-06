<?php
// Full applications require durable persistence and completed template generation.
// The existing quick-CV mail workflow remains below for the homepage intake.
if (($_POST['application_type'] ?? '') === 'full_rps_01_a') {
    try {
        require_once __DIR__ . '/includes/application_submission.php';
        app_submission();
    } catch (Throwable $e) {
        error_log('Application configuration error: ' . get_class($e));
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'The application service is unavailable. Your application has not been completed; please retry later.']);
        exit;
    }
}
/**
 * Sea & Seas Shipping Private Limited
 * Production Seafarer Career Application & Form RPS 01-A Processor
 * Compatible with PHP 8.2+ on Plesk Obsidian (Apache / Nginx)
 */

// Strict output settings & JSON headers
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

// Load SMTP Mailer helper & PHPMailer
require_once __DIR__ . '/includes/mailer.php';

// Buffer all output to guarantee clean JSON even if warnings occur
ob_start();

// Custom exception handler to return clean JSON on unexpected exceptions
set_exception_handler(function (Throwable $e) {
    if (ob_get_length()) ob_clean();
    error_log("[Sea & Seas Careers] Unhandled Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'A server error occurred while processing your application. Please email crewing@seasshipping.com directly.'
    ]);
    exit;
});

// Shutdown function to catch fatal errors and guarantee JSON output
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (ob_get_length()) ob_clean();
        error_log("[Sea & Seas Careers] Fatal Error [{$error['type']}]: {$error['message']} in {$error['file']} on line {$error['line']}");
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => 'A server processing issue occurred. Please email your CV directly to crewing@seasshipping.com.'
        ]);
    } else {
        if (ob_get_length()) ob_end_flush();
    }
});

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error'   => 'Method Not Allowed. Only POST submissions are accepted.'
    ]);
    exit;
}

// 1. Anti-Spam Honeypot Verification
if (!empty($_POST['_hp_trap'])) {
    echo json_encode([
        'success'   => true,
        'refNumber' => 'SS-ACK-TRAP',
        'message'   => 'Application received.'
    ]);
    exit;
}

// 2. Input Sanitization Helpers
function clean_input(?string $data): string {
    if ($data === null) return '';
    $data = trim($data);
    $data = stripslashes($data);
    return htmlspecialchars($data, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$appType  = clean_input($_POST['application_type'] ?? 'quick');
$isRps01A = ($appType === 'full_rps_01_a');

// Core fields (supported in both Quick Apply and Form RPS 01-A)
$fullName = clean_input($_POST['full_name'] ?? '');
$rank     = clean_input($_POST['position_applied'] ?? $_POST['rank'] ?? '');
$email    = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$phone    = clean_input($_POST['phone'] ?? '');
$indosCdc = clean_input($_POST['indos_number'] ?? $_POST['indos_cdc'] ?? $_POST['cdc_indian_no'] ?? '');
$seaTime  = clean_input($_POST['sea_time'] ?? 'Refer to attached sea service matrix');

// 3. Validate Required Fields
if (empty($fullName) || empty($rank) || empty($email) || empty($phone) || empty($indosCdc)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'All primary required fields (Full Name, Rank, Email, Phone, and INDOS/CDC) must be filled.'
    ]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'The provided email address is invalid.'
    ]);
    exit;
}

// 4. Validate Attached CV File
if (!isset($_FILES['cv_file']) || $_FILES['cv_file']['error'] !== UPLOAD_ERR_OK) {
    $uploadErrorCode = $_FILES['cv_file']['error'] ?? UPLOAD_ERR_NO_FILE;
    $errorMessage = match($uploadErrorCode) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File exceeds maximum upload size limit (10MB).',
        UPLOAD_ERR_PARTIAL   => 'File upload was only partially completed. Please try again.',
        UPLOAD_ERR_NO_FILE   => 'Please attach your CV / Resume before submitting.',
        default              => 'File upload failed. Please try again or email crewing@seasshipping.com.'
    };

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $errorMessage]);
    exit;
}

$file = $_FILES['cv_file'];
$maxSizeBytes = 10 * 1024 * 1024; // 10 Megabytes

if ($file['size'] > $maxSizeBytes) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'File exceeds 10MB limit. Please upload a compressed PDF or DOCX file.'
    ]);
    exit;
}

// 4a. Check File Extension
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowedExts = ['pdf', 'doc', 'docx'];

if (!in_array($ext, $allowedExts, true)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => "Invalid file extension (.{$ext}). Only .pdf, .doc, and .docx documents are accepted."
    ]);
    exit;
}

// 4b. MIME Type Verification using finfo
$realMimeType = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo) {
        $realMimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
    }
} elseif (function_exists('mime_content_type')) {
    $realMimeType = mime_content_type($file['tmp_name']);
}

$allowedMimes = [
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf',
    'text/pdf',
    'application/msword',
    'application/vnd.ms-word',
    'application/x-msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed'
];

if (!empty($realMimeType) && !in_array($realMimeType, $allowedMimes, true)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => "Security verification failed: File content type ({$realMimeType}) does not match an authentic PDF or Word document."
    ]);
    exit;
}

// 4c. Direct Magic Byte Header Check
$handle = @fopen($file['tmp_name'], 'rb');
if ($handle) {
    $headerBytes = fread($handle, 8);
    fclose($handle);

    $isValidMagic = false;
    if ($ext === 'pdf' && str_starts_with($headerBytes, '%PDF')) {
        $isValidMagic = true;
    } elseif ($ext === 'doc' && (str_starts_with($headerBytes, "\xD0\xCF\x11\xE0") || str_starts_with($headerBytes, "{\\rtf"))) {
        $isValidMagic = true;
    } elseif ($ext === 'docx' && str_starts_with($headerBytes, "PK\x03\x04")) {
        $isValidMagic = true;
    }

    if (!$isValidMagic) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'The uploaded file failed binary header validation. Please ensure it is an authentic PDF or Word document.'
        ]);
        exit;
    }
}

// 5. Automatic Directory Creation with Safe Permissions & Web Access Block
$uploadDir = __DIR__ . '/uploads';
if (!is_dir($uploadDir)) {
    if (!@mkdir($uploadDir, 0750, true)) {
        @mkdir($uploadDir, 0755, true);
    }
}

// Write .htaccess inside uploads/ to strictly DENY all public browser script execution
$uploadsHtaccess = $uploadDir . '/.htaccess';
if (!file_exists($uploadsHtaccess)) {
    $htaccessRules = "# STRICT SECURITY: Block all direct browser downloads and script execution\n" .
                     "<IfModule mod_authz_core.c>\n" .
                     "    Require all denied\n" .
                     "</IfModule>\n" .
                     "<IfModule !mod_authz_core.c>\n" .
                     "    Order deny,allow\n" .
                     "    Deny from all\n" .
                     "</IfModule>\n" .
                     "Options -Indexes -ExecCGI\n";
    @file_put_contents($uploadsHtaccess, $htaccessRules);
}

// Blank index.html inside uploads to prevent listing
$uploadsIndex = $uploadDir . '/index.html';
if (!file_exists($uploadsIndex)) {
    @file_put_contents($uploadsIndex, '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body><h1>Directory access is forbidden.</h1></body></html>');
}

// 6. Safe File Storage
$refNumber = 'SS-APP-' . date('Y') . '-' . rand(1000, 9999);
$sanitizedOriginal = preg_replace('/[^a-zA-Z0-9.-]/', '_', $file['name']);
$safeStoredName = date('Ymd_His') . '_' . $refNumber . '_' . $sanitizedOriginal;
$destination = $uploadDir . '/' . $safeStoredName;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    error_log("[Sea & Seas Careers] Failed to move uploaded file {$file['tmp_name']} to {$destination}");
    http_response_code(500);
    echo json_encode([
        'success'   => false,
        'refNumber' => $refNumber,
        'error'     => 'Server failed to save the uploaded CV. Please check folder write permissions.'
    ]);
    exit;
}

// 7. Collect All Form RPS 01-A Parameters
$rpsData = [];
foreach ($_POST as $k => $v) {
    if ($k === '_hp_trap' || $k === 'cv_file') continue;
    if (is_string($v)) {
        $rpsData[$k] = clean_input($v);
    }
}

// Parse sea service JSON if present
$seaServiceList = [];
if (!empty($_POST['sea_service_json'])) {
    $decoded = json_decode($_POST['sea_service_json'], true);
    if (is_array($decoded)) {
        $seaServiceList = $decoded;
    }
}

// 8. Generate Form RPS 01-A Printable HTML Document Attachment
$bioDataHtmlPath = '';
if ($isRps01A) {
    $bioDataFilename = date('Ymd_His') . '_' . $refNumber . '_Form_RPS-01A.html';
    $bioDataHtmlPath = $uploadDir . '/' . $bioDataFilename;

    // Generate Clean Sea Service Table Rows
    $seaRowsHtml = '';
    if (!empty($seaServiceList)) {
        foreach ($seaServiceList as $idx => $s) {
            $num = $idx + 1;
            $vessel = clean_input($s['sea_vessel'] ?? '-');
            $owner  = clean_input($s['sea_owner'] ?? '-');
            $built  = clean_input($s['sea_built'] ?? '-');
            $type   = clean_input($s['sea_type'] ?? '-');
            $grt    = clean_input($s['sea_grt'] ?? '-');
            $dwt    = clean_input($s['sea_dwt'] ?? '-');
            $eng    = clean_input($s['sea_engine'] ?? '-');
            $bhp    = clean_input($s['sea_bhp'] ?? '-');
            $r      = clean_input($s['sea_rank'] ?? '-');
            $from   = clean_input($s['sea_from'] ?? '-');
            $to     = clean_input($s['sea_to'] ?? '-');
            $dur    = clean_input($s['sea_total'] ?? '-');
            $reason = clean_input($s['sea_reason'] ?? '-');

            $seaRowsHtml .= "<tr>
                <td style='text-align:center;'>{$num}</td>
                <td>{$owner}</td>
                <td><strong>{$vessel}</strong></td>
                <td>{$built}</td>
                <td>{$type}</td>
                <td>{$grt}</td>
                <td>{$dwt}</td>
                <td>{$eng}</td>
                <td>{$bhp}</td>
                <td><strong>{$r}</strong></td>
                <td>{$from}</td>
                <td>{$to}</td>
                <td>{$dur}</td>
                <td>{$reason}</td>
            </tr>";
        }
    } else {
        $seaRowsHtml = "<tr><td colspan='14' style='text-align:center;padding:12px;color:#666;'>Refer to candidate attached CV for complete historical sea-service records.</td></tr>";
    }

    // Complete Bio-Data HTML representation matching NEW APPLICATION FORMAT.docx
    $bioDataDoc = '<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Form RPS 01-A - Seafarer Bio-Data (' . $refNumber . ')</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #111; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
        .header h1 { margin: 0 0 2px 0; font-size: 16px; text-transform: uppercase; }
        .header p { margin: 2px 0; font-size: 10px; color: #444; }
        .meta-bar { display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        .sec-title { background: #e2e8f0; font-weight: bold; font-size: 11px; padding: 4px 6px; margin: 12px 0 6px 0; text-transform: uppercase; border-left: 3px solid #183358; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
        th, td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
        th { background: #f1f5f9; text-align: left; }
        .declaration { background: #fdfdfd; border: 1px solid #999; padding: 8px; margin-top: 14px; font-size: 9.5px; line-height: 1.5; }
        .sig-block { display: flex; justify-content: space-between; margin-top: 25px; padding-top: 10px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Sea &amp; Seas Shipping Private Limited</h1>
        <p>410, Concorde Bldg, Plot 66A, Sector-11, CBD Belapur, Navi Mumbai &bull; ISO 9001:2015 &bull; MLC 2006 Compliant</p>
        <p><strong>FORM RPS 01-A &bull; SEAFARER COMPREHENSIVE APPLICATION &amp; BIO-DATA</strong></p>
      </div>

      <div class="meta-bar">
        <span>Application Ref: ' . $refNumber . '</span>
        <span>Date Applied: ' . date('d-M-Y H:i:s T') . '</span>
        <span>Rank Applied: ' . $rank . '</span>
      </div>

      <div class="sec-title">1. Position &amp; Personal Details</div>
      <table>
        <tr>
          <th style="width:20%;">Position Applied For</th>
          <td><strong>' . $rank . '</strong></td>
          <th style="width:20%;">Accept Lower Rank?</th>
          <td>' . clean_input($rpsData['accept_lower_rank'] ?? 'NO') . '</td>
          <th style="width:20%;">Date of Availability</th>
          <td>' . clean_input($rpsData['date_availability'] ?? '-') . '</td>
        </tr>
        <tr>
          <th>Full Name</th>
          <td colspan="3"><strong>' . $fullName . '</strong></td>
          <th>Date of Birth / Age</th>
          <td>' . clean_input($rpsData['dob'] ?? '-') . '</td>
        </tr>
        <tr>
          <th>Place of Birth</th>
          <td>' . clean_input($rpsData['pob'] ?? '-') . '</td>
          <th>Nationality</th>
          <td>' . clean_input($rpsData['nationality'] ?? '-') . '</td>
          <th>Marital Status</th>
          <td>' . clean_input($rpsData['marital_status'] ?? '-') . '</td>
        </tr>
        <tr>
          <th>Permanent Address</th>
          <td colspan="3">' . clean_input($rpsData['permanent_address'] ?? '-') . ' (PIN: ' . clean_input($rpsData['permanent_postcode'] ?? '-') . ')</td>
          <th>Nearest Airport</th>
          <td>' . clean_input($rpsData['nearest_airport'] ?? '-') . '</td>
        </tr>
        <tr>
          <th>Present Address</th>
          <td colspan="3">' . clean_input($rpsData['present_address'] ?? '-') . '</td>
          <th>Contact Numbers</th>
          <td>' . $phone . ' / ' . clean_input($rpsData['permanent_phone'] ?? '-') . '</td>
        </tr>
        <tr>
          <th>Height / Weight</th>
          <td>' . clean_input($rpsData['height_cm'] ?? '-') . ' cm / ' . clean_input($rpsData['weight_kg'] ?? '-') . ' kg</td>
          <th>Boiler Suit Size</th>
          <td>' . clean_input($rpsData['boiler_suit_size'] ?? '-') . '</td>
          <th>Safety Shoe Size</th>
          <td>' . clean_input($rpsData['shoe_size'] ?? '-') . '</td>
        </tr>
      </table>

      <div class="sec-title">2. Next of Kin &amp; Family Details</div>
      <table>
        <tr>
          <th style="width:20%;">Next of Kin Name</th>
          <td>' . clean_input($rpsData['kin_name'] ?? '-') . '</td>
          <th style="width:20%;">Relationship</th>
          <td>' . clean_input($rpsData['kin_relationship'] ?? '-') . '</td>
          <th style="width:20%;">Contact Phone</th>
          <td>' . clean_input($rpsData['kin_phone_primary'] ?? '-') . '</td>
        </tr>
        <tr>
          <th>Address of Next of Kin</th>
          <td colspan="5">' . clean_input($rpsData['kin_address'] ?? '-') . ' (PIN: ' . clean_input($rpsData['kin_postcode'] ?? '-') . ')</td>
        </tr>
      </table>

      <div class="sec-title">3. Statutory Medical History</div>
      <table>
        <tr>
          <th style="width:50%;">Signed off from ship due to medical reasons?</th>
          <td>' . clean_input($rpsData['medical_signoff'] ?? 'No') . ' ' . (!empty($rpsData['med_description']) ? '(' . clean_input($rpsData['med_description']) . ')' : '') . '</td>
        </tr>
        <tr>
          <th>Suffering from disease rendering unfit for service at sea?</th>
          <td>' . clean_input($rpsData['medical_unfit_disease'] ?? 'No') . '</td>
        </tr>
        <tr>
          <th>Addicted to alcohol or drugs of any kind?</th>
          <td>' . clean_input($rpsData['medical_addiction'] ?? 'No') . '</td>
        </tr>
        <tr>
          <th>History of Malaria / Diabetes / Epilepsy / Nervous Disability / Hepatitis:</th>
          <td>Malaria: ' . clean_input($rpsData['med_malaria'] ?? 'No') . ' | Diabetes: ' . clean_input($rpsData['med_diabetes'] ?? 'No') . ' | Epilepsy: ' . clean_input($rpsData['med_epilepsy'] ?? 'No') . ' | Hepatitis: ' . clean_input($rpsData['med_hepatitis'] ?? 'No') . '</td>
        </tr>
        <tr>
          <th>Undergone psychiatric treatment?</th>
          <td>' . clean_input($rpsData['medical_psychiatric'] ?? 'No') . '</td>
        </tr>
      </table>

      <div class="sec-title">4. Travel Documents &amp; Certifications</div>
      <table>
        <tr>
          <th>Passport Number</th>
          <td>' . clean_input($rpsData['passport_no'] ?? '-') . '</td>
          <th>Date of Issue / Expiry</th>
          <td>' . clean_input($rpsData['passport_doi'] ?? '-') . ' to ' . clean_input($rpsData['passport_doe'] ?? '-') . '</td>
          <th>ECNR / Blank Pages</th>
          <td>' . clean_input($rpsData['passport_ecnr'] ?? '-') . ' (' . clean_input($rpsData['passport_blank_pages'] ?? '-') . ' pages)</td>
        </tr>
        <tr>
          <th>INDOS Number</th>
          <td>' . $indosCdc . '</td>
          <th>Indian CDC Number</th>
          <td>' . clean_input($rpsData['cdc_indian_no'] ?? '-') . '</td>
          <th>CoC / License Number</th>
          <td>' . clean_input($rpsData['coc_indian_no'] ?? clean_input($rpsData['coc_uk_no'] ?? '-')) . '</td>
        </tr>
        <tr>
          <th>U.S. VISA</th>
          <td>' . clean_input($rpsData['us_visa_type'] ?? 'None') . ' (Exp: ' . clean_input($rpsData['us_visa_doe'] ?? '-') . ')</td>
          <th>MUI Membership</th>
          <td>' . clean_input($rpsData['mui_membership_no'] ?? '-') . '</td>
          <th>Yellow Fever / STCW</th>
          <td>Valid &bull; STCW 2010 Manila Compliant</td>
        </tr>
      </table>

      <div class="sec-title">5. Previous Sea Service (Last 10 Years)</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Owner / Manager</th>
            <th>Vessel Name</th>
            <th>Built</th>
            <th>Type</th>
            <th>GRT</th>
            <th>DWT</th>
            <th>Engine</th>
            <th>BHP</th>
            <th>Rank</th>
            <th>From</th>
            <th>To</th>
            <th>Total</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ' . $seaRowsHtml . '
        </tbody>
      </table>

      <div class="sec-title">6. Wages &amp; Banking Details</div>
      <table>
        <tr>
          <th style="width:20%;">Last Drawn Wages</th>
          <td>' . clean_input($rpsData['last_drawn_wages'] ?? '-') . '</td>
          <th style="width:20%;">Expected Wages</th>
          <td>' . clean_input($rpsData['expected_wages'] ?? '-') . '</td>
        </tr>
        <tr>
          <th>Bank Name &amp; Holder</th>
          <td>' . clean_input($rpsData['bank_name'] ?? '-') . ' (' . clean_input($rpsData['bank_holder_name'] ?? '-') . ')</td>
          <th>Account No. &amp; IFSC</th>
          <td><code>' . clean_input($rpsData['bank_account_no'] ?? '-') . '</code> (IFSC: ' . clean_input($rpsData['bank_ifsc'] ?? '-') . ')</td>
        </tr>
      </table>

      <div class="declaration">
        <strong>SEAFARER DECLARATION &amp; ZERO-RECRUITMENT FEE CONFIRMATION:</strong><br>
        I declare that all information provided by me in this application is true and correct to the best of my knowledge and belief; Further, that no Certificate of Competency or License issued to me has ever been Revoked or Suspended. I also certify that my medical history contained above is true and if any false statement or undisclosed material information about past illness or injury will disqualify me from any employment benefits and claims.<br>
        <strong>I confirm that I have not paid any donation / recruitment fees / service charge / any other charge for joining the vessel.</strong>
      </div>

      <div class="sig-block">
        <div>
          <b>Candidate Signature:</b> ' . clean_input($rpsData['digital_signature_name'] ?? $fullName) . '<br>
          <b>Place / Date:</b> ' . clean_input($rpsData['signature_place'] ?? 'India') . ' &bull; ' . clean_input($rpsData['signature_date'] ?? date('d-M-Y')) . '
        </div>
        <div style="text-align:right;">
          <b>Received For Sea &amp; Seas Shipping Pvt. Ltd.</b><br>
          Crewing &amp; Technical Recruitment Desk
        </div>
      </div>
    </body>
    </html>';

    @file_put_contents($bioDataHtmlPath, $bioDataDoc);
}

// 9. Save Application Record in applications_roster.json & Archive Directory
$archiveDir = __DIR__ . '/applications_archive';
if (!is_dir($archiveDir)) {
    @mkdir($archiveDir, 0750, true);
}
@file_put_contents($archiveDir . '/' . $refNumber . '.json', json_encode(array_merge($rpsData, [
    'refNumber'     => $refNumber,
    'submittedAt'   => date('c'),
    'cvOriginal'    => $file['name'],
    'cvStoredPath'  => 'uploads/' . $safeStoredName,
    'seaService'    => $seaServiceList
]), JSON_PRETTY_PRINT));

$rosterFile = __DIR__ . '/applications_roster.json';
$record = [
    'refNumber'     => $refNumber,
    'type'          => $isRps01A ? 'Form RPS 01-A' : 'Quick Apply',
    'submittedAt'   => date('c'),
    'fullName'      => $fullName,
    'rank'          => $rank,
    'email'         => $email,
    'phone'         => $phone,
    'indosCdc'      => $indosCdc,
    'seaTime'       => $seaTime,
    'cvOriginal'    => $file['name'],
    'cvStoredPath'  => 'uploads/' . $safeStoredName,
    'fileSizeBytes' => $file['size']
];

$roster = [];
if (file_exists($rosterFile)) {
    $existing = @file_get_contents($rosterFile);
    if (!empty($existing)) {
        $roster = json_decode($existing, true) ?: [];
    }
}
array_unshift($roster, $record);
@file_put_contents($rosterFile, json_encode(array_slice($roster, 0, 100), JSON_PRETTY_PRINT));

// 10. Dispatch Email via Authenticated SMTP (PHPMailer)
$mailSent = false;
$mailError = '';

try {
    $mail = create_smtp_mailer();
    $mailerConfig = get_mailer_config();

    // Primary Recipient: Destination for form submissions
    $destinationRecipient = !empty($mailerConfig['to_address']) ? $mailerConfig['to_address'] : 'ohmeujjawal@gmail.com';
    $mail->addAddress($destinationRecipient, 'Sea & Seas Operations Desk');

    // Reply-To: Candidate Email & Crewing Desk
    $mail->addReplyTo($email, $fullName);
    if (!empty($mailerConfig['reply_to']) && strcasecmp($mailerConfig['reply_to'], $email) !== 0) {
        $mail->addReplyTo($mailerConfig['reply_to'], 'Sea & Seas Crewing Desk');
    }

    // Email Subject
    $formTypeLabel = $isRps01A ? '[Form RPS 01-A Seafarer Intake]' : '[Seafarer Career Application]';
    $mail->Subject = "{$formTypeLabel} {$rank} - {$fullName} ({$refNumber})";

    // Build Responsive HTML Email Body
    $htmlBody = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 660px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: #0A192F; color: #ffffff; padding: 24px 30px; border-bottom: 3px solid #0284c7; }
        .header h1 { margin: 0 0 4px 0; font-size: 19px; font-weight: 700; color: #ffffff; }
        .header p { margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 12px; margin-top: 10px; }
        .content { padding: 28px 30px; }
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #64748b; margin: 0 0 14px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
        .data-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
        .data-table th { text-align: left; padding: 9px 12px; background: #f8fafc; color: #475569; font-size: 13px; width: 35%; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .data-table td { padding: 9px 12px; color: #0f172a; font-size: 13.5px; border-bottom: 1px solid #e2e8f0; }
        .attachment-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px; margin: 18px 0; }
        .footer { background: #f8fafc; padding: 18px 30px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Sea &amp; Seas Shipping Private Limited</h1>
          <p>' . ($isRps01A ? 'Official Seafarer Bio-Data (Form RPS 01-A)' : 'New Seafarer Career Application') . ' &bull; Intake Portal</p>
          <div class="badge">Application Ref: ' . htmlspecialchars($refNumber, ENT_QUOTES, 'UTF-8') . '</div>
        </div>
        <div class="content">
          <div class="section-title">Candidate Profile &amp; Core Records</div>
          <table class="data-table">
            <tr>
              <th>Applicant Name</th>
              <td><strong>' . htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8') . '</strong></td>
            </tr>
            <tr>
              <th>Rank Applied For</th>
              <td><strong style="color: #0284c7;">' . htmlspecialchars($rank, ENT_QUOTES, 'UTF-8') . '</strong></td>
            </tr>
            <tr>
              <th>Email Address</th>
              <td><a href="mailto:' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</a></td>
            </tr>
            <tr>
              <th>Contact Phone Number</th>
              <td><a href="tel:' . htmlspecialchars($phone, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($phone, ENT_QUOTES, 'UTF-8') . '</a></td>
            </tr>
            <tr>
              <th>INDOS / CDC No.</th>
              <td><code>' . htmlspecialchars($indosCdc, ENT_QUOTES, 'UTF-8') . '</code></td>
            </tr>';

    if ($isRps01A) {
        $htmlBody .= '
            <tr>
              <th>Availability Date</th>
              <td>' . htmlspecialchars($rpsData['date_availability'] ?? '-', ENT_QUOTES, 'UTF-8') . '</td>
            </tr>
            <tr>
              <th>Passport No / Expiry</th>
              <td>' . htmlspecialchars($rpsData['passport_no'] ?? '-', ENT_QUOTES, 'UTF-8') . ' (Exp: ' . htmlspecialchars($rpsData['passport_doe'] ?? '-', ENT_QUOTES, 'UTF-8') . ')</td>
            </tr>
            <tr>
              <th>Expected Wages</th>
              <td>' . htmlspecialchars($rpsData['expected_wages'] ?? 'As per Matrix', ENT_QUOTES, 'UTF-8') . '</td>
            </tr>';
    } else {
        $htmlBody .= '
            <tr>
              <th>Sea-Time Experience</th>
              <td>' . htmlspecialchars($seaTime, ENT_QUOTES, 'UTF-8') . '</td>
            </tr>';
    }

    $htmlBody .= '
            <tr>
              <th>Submission Time</th>
              <td>' . date('d-M-Y H:i:s T') . '</td>
            </tr>
          </table>

          <div class="section-title">Verified Attachments</div>
          <div class="attachment-box">
            <strong>📎 Attached Candidate CV:</strong> ' . htmlspecialchars($file['name'], ENT_QUOTES, 'UTF-8') . ' (' . round($file['size'] / 1024, 1) . ' KB)<br>';

    if ($isRps01A && file_exists($bioDataHtmlPath)) {
        $htmlBody .= '<strong>📋 Attached Bio-Data Dossier:</strong> Form RPS 01-A (' . basename($bioDataHtmlPath) . ')<br>';
    }

    $htmlBody .= '
            <span style="font-size:12px; color:#475569;">Verified documents attached directly to this email transmission.</span>
          </div>
        </div>
        <div class="footer">
          Dispatched automatically via authenticated SMTP from <strong>Sea &amp; Seas Mail Gateway</strong>.<br>
          Click <strong>Reply</strong> to respond directly to candidate ' . htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8') . ' (' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . ').
        </div>
      </div>
    </body>
    </html>';

    // Plain Text Body Construct
    $altBody = "Sea & Seas Shipping Private Limited — Seafarer Application\r\n" .
               "=========================================================\r\n\r\n" .
               "Application Ref : {$refNumber}\r\n" .
               "Form Type       : " . ($isRps01A ? 'Official Form RPS 01-A' : 'Quick Application') . "\r\n" .
               "Submission Time : " . date('d-M-Y H:i:s T') . "\r\n\r\n" .
               "Applicant Name  : {$fullName}\r\n" .
               "Rank Applied For: {$rank}\r\n" .
               "Email Address   : {$email}\r\n" .
               "Contact Phone   : {$phone}\r\n" .
               "INDOS / CDC No. : {$indosCdc}\r\n" .
               "Attached Resume : {$file['name']} (" . round($file['size'] / 1024, 1) . " KB)\r\n" .
               "Stored Location : uploads/{$safeStoredName}\r\n\r\n" .
               "---------------------------------------------------------\r\n" .
               "Candidate CV is attached to this email.\r\n" .
               "To reply directly to the applicant, simply click Reply.\r\n";

    $mail->isHTML(true);
    $mail->Body    = $htmlBody;
    $mail->AltBody = $altBody;

    // Attach CV file directly from stored path
    $mail->addAttachment($destination, $sanitizedOriginal);

    // If Form RPS 01-A, attach generated HTML bio-data dossier
    if ($isRps01A && file_exists($bioDataHtmlPath)) {
        $mail->addAttachment($bioDataHtmlPath, "BioData_RPS-01A_{$refNumber}_{$sanitizedOriginal}.html");
    }

    // Send the email via SMTP
    $mail->send();
    $mailSent = true;

} catch (\Throwable $e) {
    $mailError = $e->getMessage();
    error_log("[Sea & Seas Careers] SMTP Delivery Error for {$refNumber}: " . $mailError);

    // Resilient Fallback: If SMTP socket is refused, fallback to server native PHP mail()
    try {
        error_log("[Sea & Seas Careers] Attempting native mail() fallback for {$refNumber}...");
        $mail->isMail();
        $mail->UseSendmailOptions = false;
        $mail->Sender = '';
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            @ini_set('sendmail_from', (string)$mailerConfig['from_address']);
        }
        $mail->send();
        $mailSent = true;
        error_log("[Sea & Seas Careers] Successfully dispatched {$refNumber} via native PHP mail() fallback.");
    } catch (\Throwable $e2) {
        $mailSent = false;
        $mailError .= ' | Fallback mail(): ' . $e2->getMessage();
        error_log("[Sea & Seas Careers] Native mail() fallback failed for {$refNumber}: " . $e2->getMessage());
    }
}

if (!$mailSent) {
    http_response_code(500);
    echo json_encode([
        'success'   => false,
        'refNumber' => $refNumber,
        'error'     => 'Server was unable to dispatch the application email via SMTP. Please email your CV to crewing@seasshipping.com.',
        'code'      => 'SMTP_DELIVERY_FAILED',
        'details'   => $mailError ?? 'Unknown SMTP error'
    ]);
    exit;
}

// 11. Return JSON Confirmation
echo json_encode([
    'success'         => true,
    'refNumber'       => $refNumber,
    'emailDispatched' => true,
    'message'         => 'Application and Seafarer Bio-Data successfully received and queued at the crewing desk.'
]);
