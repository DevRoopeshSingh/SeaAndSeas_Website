<?php
/**
 * Sea & Seas Shipping Private Limited
 * Production Seafarer Career Application & CV Upload Processor
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
    // Silently acknowledge to fool automated spam bots
    echo json_encode([
        'success'   => true,
        'refNumber' => 'SS-ACK-TRAP',
        'message'   => 'Application received.'
    ]);
    exit;
}

// 2. Extract and Sanitize Text Inputs
function clean_input(?string $data): string {
    if ($data === null) return '';
    $data = trim($data);
    $data = stripslashes($data);
    return htmlspecialchars($data, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$fullName = clean_input($_POST['full_name'] ?? '');
$rank     = clean_input($_POST['rank'] ?? '');
$email    = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$phone    = clean_input($_POST['phone'] ?? '');
$indosCdc = clean_input($_POST['indos_cdc'] ?? '');
$seaTime  = clean_input($_POST['sea_time'] ?? 'None specified');

// 3. Validate Required Fields
if (empty($fullName) || empty($rank) || empty($email) || empty($phone) || empty($indosCdc)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'All required fields (Full Name, Rank, Email, Phone, INDOS/CDC) must be filled.'
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

// 4b. MIME Type Verification using finfo (Magic Bytes)
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

// Allowed MIME types for PDF, DOC, and DOCX
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
    'application/zip',             // Some server OS identify docx as zip container
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

// Write .htaccess inside uploads/ to strictly DENY all public browser access and script execution
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

// Blank index.html inside uploads to prevent listing if .htaccess is bypassed
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

// 7. Append Application Record to applications_roster.json
$rosterFile = __DIR__ . '/applications_roster.json';
$record = [
    'refNumber'     => $refNumber,
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

// 8. Dispatch Email via Authenticated SMTP (PHPMailer)
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
    $mail->Subject = "[Seafarer Application] {$rank} - {$fullName} ({$refNumber})";

    // Build Responsive HTML Email Body
    $htmlBody = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
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
          <p>New Seafarer Career Application &bull; Intake Portal</p>
          <div class="badge">Application Ref: ' . htmlspecialchars($refNumber, ENT_QUOTES, 'UTF-8') . '</div>
        </div>
        <div class="content">
          <div class="section-title">Candidate Profile &amp; Sea Service</div>
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
              <th>Phone / WhatsApp</th>
              <td><a href="tel:' . htmlspecialchars($phone, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($phone, ENT_QUOTES, 'UTF-8') . '</a></td>
            </tr>
            <tr>
              <th>INDOS / CDC No.</th>
              <td><code>' . htmlspecialchars($indosCdc, ENT_QUOTES, 'UTF-8') . '</code></td>
            </tr>
            <tr>
              <th>Sea-Time Experience</th>
              <td>' . htmlspecialchars($seaTime, ENT_QUOTES, 'UTF-8') . '</td>
            </tr>
            <tr>
              <th>Submission Time</th>
              <td>' . date('d-M-Y H:i:s T') . '</td>
            </tr>
          </table>

          <div class="section-title">Attached Curriculum Vitae</div>
          <div class="attachment-box">
            <strong>📎 Attached File:</strong> ' . htmlspecialchars($file['name'], ENT_QUOTES, 'UTF-8') . ' (' . round($file['size'] / 1024, 1) . ' KB)<br>
            <span style="font-size:12px; color:#475569;">Verified document attached directly to this email transmission.</span>
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
               "Submission Time : " . date('d-M-Y H:i:s T') . "\r\n\r\n" .
               "Applicant Name  : {$fullName}\r\n" .
               "Rank Applied For: {$rank}\r\n" .
               "Email Address   : {$email}\r\n" .
               "WhatsApp / Phone: {$phone}\r\n" .
               "INDOS / CDC No. : {$indosCdc}\r\n" .
               "Sea-Time Rank   : {$seaTime}\r\n\r\n" .
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

    // Send the email via SMTP
    $mail->send();
    $mailSent = true;

} catch (\Throwable $e) {
    $mailError = $e->getMessage();
    error_log("[Sea & Seas Careers] SMTP Delivery Error for {$refNumber}: " . $mailError);

    // Resilient Fallback: If SMTP socket is refused (e.g. error 10061), fallback to server native PHP mail()
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
        'error'     => 'Server was unable to dispatch the application email via SMTP. Please use the direct email button below to send your CV to crewing@seasshipping.com.',
        'code'      => 'SMTP_DELIVERY_FAILED',
        'details'   => $mailError ?? 'Unknown SMTP error'
    ]);
    exit;
}

// 9. Return JSON Confirmation
echo json_encode([
    'success'         => true,
    'refNumber'       => $refNumber,
    'emailDispatched' => true,
    'message'         => 'Application and CV successfully received and dispatched to the crewing desk.'
]);
