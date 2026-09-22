<?php
/**
 * Sea & Seas Shipping Private Limited
 * SMTP Mailer Diagnostic & Verification Tool (Secured)
 *
 * Use this script to verify that your Plesk SMTP mailbox (website@seasshipping.com)
 * can authenticate and send outgoing emails to the administrative address.
 *
 * URL: https://seasshipping.com/test-mail.php?key=seas2026
 */

declare(strict_types=1);

ini_set('display_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/includes/mailer.php';

use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// 1. Gather Mailer Configuration
$config = get_mailer_config();

// 2. Security Guard: Access Key Authorization
// Prevents search crawlers and external bots from triggering mail tests or viewing logs
$expectedKey = get_env_var('DIAGNOSTIC_KEY', 'seas2026');
$providedKey = $_REQUEST['key'] ?? '';
$isAuthorized = (PHP_SAPI === 'cli' || (!empty($providedKey) && hash_equals($expectedKey, (string)$providedKey)));

// If not authorized in browser mode, display password/key gatekeeper
if (!$isAuthorized && PHP_SAPI !== 'cli') {
    http_response_code(403);
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Required &bull; Sea &amp; Seas Mail Diagnostic</title>
      <style>
        body {
          margin: 0; padding: 40px 16px; background-color: #0A192F; color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex; align-items: center; justify-content: center; min-height: 80vh;
        }
        .login-card {
          background: #112240; border: 1px solid #233554; border-radius: 12px;
          padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          text-align: center;
        }
        h2 { margin: 0 0 10px 0; font-size: 20px; color: #fff; }
        p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
        input[type="password"], input[type="text"] {
          width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 6px;
          border: 1px solid #233554; background: #020617; color: #fff; font-size: 15px; margin-bottom: 16px;
        }
        button {
          width: 100%; padding: 12px; background: #0284c7; color: #fff; border: none;
          border-radius: 6px; font-weight: 600; font-size: 15px; cursor: pointer;
        }
        button:hover { background: #0369a1; }
        .error { color: #f87171; font-size: 13px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="login-card">
        <h2>🔒 Diagnostic Access Guard</h2>
        <p>Access key required to view SMTP status and execute mail relay tests.</p>
        <?php if (!empty($providedKey)): ?>
          <div class="error">Invalid access key. Please try again.</div>
        <?php endif; ?>
        <form method="GET" action="test-mail.php">
          <input type="password" name="key" placeholder="Enter Access Key (default: seas2026)" autofocus required>
          <button type="submit">Unlock Diagnostic Suite</button>
        </form>
      </div>
    </body>
    </html>
    <?php
    exit;
}

// 2b. Allow authorized admin to test alternative host, port, and encryption on the fly
if (!empty($_REQUEST['mailer'])) {
    $config['mailer'] = strtolower(trim($_REQUEST['mailer']));
}
if (!empty($_REQUEST['host'])) {
    $config['host'] = trim($_REQUEST['host']);
}
if (!empty($_REQUEST['port'])) {
    $config['port'] = (int) $_REQUEST['port'];
}
if (isset($_REQUEST['enc'])) {
    $config['encryption'] = strtolower(trim($_REQUEST['enc']));
}

// 3. Security: Destination Recipient Enforcement (Prevent Open Relay)
$defaultTo = $config['to_address'] ?: 'ohmeujjawal@gmail.com';
$requestedTo = !empty($_REQUEST['to']) ? filter_var($_REQUEST['to'], FILTER_VALIDATE_EMAIL) : null;

// Only allow sending to pre-configured to_address or seasshipping.com domain mailboxes
if ($requestedTo && (str_ends_with(strtolower($requestedTo), '@seasshipping.com') || strtolower($requestedTo) === strtolower($defaultTo))) {
    $toAddress = $requestedTo;
} else {
    $toAddress = $defaultTo;
}

$hasPassword = !empty($config['password']);
$maskedPassword = $hasPassword ? str_repeat('•', min(strlen($config['password']), 16)) . ' (' . strlen($config['password']) . ' chars)' : '<span style="color:#ef4444;font-weight:bold;">[NOT SET - Empty in .env]</span>';

// 4. Determine Action: Execute dispatch only on explicit send request
$shouldSend = (isset($_REQUEST['action']) && $_REQUEST['action'] === 'send') ||
              (isset($_REQUEST['send']) && $_REQUEST['send'] === '1') ||
              (PHP_SAPI === 'cli' && in_array('--send', $argv ?? [], true));

$debugLogs = [];
$debugCollector = function (string $str, int $level) use (&$debugLogs): void {
    $cleanStr = trim($str);
    if ($cleanStr !== '') {
        $debugLogs[] = [
            'level'   => $level,
            'time'    => microtime(true),
            'message' => $cleanStr
        ];
    }
};

$testExecuted = false;
$testSuccess = false;
$errorMessage = '';
$executionTimeMs = 0;

if ($shouldSend) {
    $testExecuted = true;
    $startTime = microtime(true);

    $isMailDriver = (strtolower((string)($config['mailer'] ?? '')) === 'mail' || strtolower((string)$config['host']) === 'mail');
    if (!$hasPassword && !$isMailDriver) {
        $testSuccess = false;
        $errorMessage = 'MAIL_PASSWORD is not configured. Please create a `.env` file in your website root (or configure PHP environment variables in Plesk) and set MAIL_PASSWORD to your mailbox password.';
    } else {
        try {
            $mail = create_smtp_mailer(true, $debugCollector, $config);

            $mail->addAddress($toAddress, 'Sea & Seas Mail Verification');
            if (!empty($config['reply_to'])) {
                $mail->addReplyTo($config['reply_to'], 'Sea & Seas Crewing Desk');
            }

            $mail->Subject = 'SMTP Verification Test: ' . $config['from_name'] . ' [' . date('Y-m-d H:i:s') . ']';

            $mail->isHTML(true);
            $mail->Body = '
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; background: #f8fafc; padding: 20px; }
                .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
                .success-badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
                th { text-align: left; padding: 8px 10px; background: #f1f5f9; color: #475569; border-bottom: 1px solid #e2e8f0; }
                td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="header">
                  <h2 style="margin:0 0 4px 0; color:#0A192F;">Sea &amp; Seas Shipping Mail Gateway</h2>
                  <div class="success-badge">✓ SMTP Relay Test Passed</div>
                </div>
                <p>This is a verification email confirming that authenticated SMTP email dispatch from <strong>' . htmlspecialchars($config['from_address']) . '</strong> to <strong>' . htmlspecialchars($toAddress) . '</strong> is functioning normally.</p>
                <table>
                  <tr><th>SMTP Host</th><td>' . htmlspecialchars($config['host']) . '</td></tr>
                  <tr><th>Port &amp; Security</th><td>' . htmlspecialchars((string)$config['port']) . ' (' . strtoupper(htmlspecialchars($config['encryption'])) . ')</td></tr>
                  <tr><th>Authenticated User</th><td>' . htmlspecialchars($config['username']) . '</td></tr>
                  <tr><th>Sent At</th><td>' . date('r') . '</td></tr>
                  <tr><th>Server Host</th><td>' . htmlspecialchars($_SERVER['SERVER_NAME'] ?? 'localhost') . '</td></tr>
                </table>
                <p style="font-size:12px;color:#64748b;margin-top:20px;">Automated test generated by <code>test-mail.php</code>.</p>
              </div>
            </body>
            </html>';

            $mail->AltBody = "Sea & Seas Shipping SMTP Test\r\n" .
                             "=============================\r\n" .
                             "Status: SUCCESS\r\n" .
                             "From: {$config['from_address']} ({$config['from_name']})\r\n" .
                             "To: {$toAddress}\r\n" .
                             "SMTP Host: {$config['host']}:{$config['port']} (" . strtoupper($config['encryption']) . ")\r\n" .
                             "Time: " . date('r') . "\r\n";

            $mail->send();
            $testSuccess = true;

        } catch (\Throwable $e) {
            $testSuccess = false;
            $errorMessage = $e->getMessage();
        }
    }

    $executionTimeMs = round((microtime(true) - $startTime) * 1000, 2);
}

// 5. CLI / JSON Output Mode
$isJson = (isset($_GET['format']) && $_GET['format'] === 'json') || (PHP_SAPI === 'cli' && in_array('--json', $argv ?? [], true));

if ($isJson) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'authorized'      => $isAuthorized,
        'executed'        => $testExecuted,
        'success'         => $testSuccess,
        'executionTimeMs' => $executionTimeMs,
        'error'           => $errorMessage ?: null,
        'config'          => [
            'host'         => $config['host'],
            'port'         => $config['port'],
            'encryption'   => $config['encryption'],
            'username'     => $config['username'],
            'passwordSet'  => $hasPassword,
            'from_address' => $config['from_address'],
            'from_name'    => $config['from_name'],
            'to_address'   => $toAddress,
            'reply_to'     => $config['reply_to']
        ],
        'debugLogs'       => array_column($debugLogs, 'message')
    ], JSON_PRETTY_PRINT);
    exit;
}

// 6. CLI Output
if (PHP_SAPI === 'cli') {
    echo "========================================================\n";
    echo " Sea & Seas Shipping - SMTP Verification Tool\n";
    echo "========================================================\n";
    echo "Host: {$config['host']}:{$config['port']} (" . strtoupper($config['encryption']) . ")\n";
    echo "User: {$config['username']}\n";
    echo "From: {$config['from_name']} <{$config['from_address']}>\n";
    echo "To  : {$toAddress}\n";
    echo "Pass: " . ($hasPassword ? '[SET]' : '[NOT SET]') . "\n";
    echo "--------------------------------------------------------\n";
    if ($shouldSend) {
        if ($testSuccess) {
            echo "RESULT: SUCCESS! Email sent in {$executionTimeMs}ms\n";
        } else {
            echo "RESULT: FAILED!\nError: {$errorMessage}\n";
        }
    } else {
        echo "Ready. Re-run with --send flag to trigger email test.\n";
    }
    echo "========================================================\n";
    exit($testSuccess || !$shouldSend ? 0 : 1);
}

// 7. Rich HTML Diagnostic View
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMTP Mail Gateway Diagnostic &bull; Sea &amp; Seas Shipping</title>
  <style>
    :root {
      --bg: #0A192F;
      --card-bg: #112240;
      --border: #233554;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --primary: #0284c7;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 24px;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .status-banner {
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      font-size: 14.5px;
    }
    .status-banner.success {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
    }
    .status-banner.danger {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .status-banner.info {
      background: rgba(2, 132, 199, 0.12);
      border: 1px solid rgba(2, 132, 199, 0.4);
      color: #7dd3fc;
    }
    .status-icon {
      font-size: 24px;
      line-height: 1;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .config-item {
      background: rgba(2, 6, 23, 0.35);
      border: 1px solid var(--border);
      padding: 12px 14px;
      border-radius: 6px;
    }
    .config-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .config-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      color: #38bdf8;
      word-break: break-all;
    }
    .log-box {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 16px;
      max-height: 320px;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      color: #94a3b8;
    }
    .log-line {
      margin-bottom: 3px;
      white-space: pre-wrap;
    }
    .log-line.smtp-in { color: #38bdf8; }
    .log-line.smtp-out { color: #a78bfa; }
    .log-line.smtp-err { color: #f87171; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--primary);
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .btn:hover { background: #0369a1; }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.05); }
    .btn-group {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .tip-box {
      background: rgba(2, 132, 199, 0.08);
      border-left: 3px solid var(--primary);
      padding: 12px 16px;
      font-size: 13px;
      color: #cbd5e1;
      margin-top: 16px;
      border-radius: 0 6px 6px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sea &amp; Seas Shipping &bull; Mail Gateway Test</h1>
      <p>Plesk Authenticated SMTP Diagnostic Suite (PHP <?= htmlspecialchars(phpversion()) ?>)</p>
    </div>

    <!-- Status Banner -->
    <?php if ($testExecuted): ?>
      <?php if ($testSuccess): ?>
        <div class="status-banner success">
          <div class="status-icon">✓</div>
          <div>
            <strong style="font-size:16px;">SUCCESS: SMTP Verification Email Dispatched!</strong><br>
            An authenticated test message was successfully accepted by <code><?= htmlspecialchars($config['host']) ?></code> and dispatched to <code><?= htmlspecialchars($toAddress) ?></code> in <strong><?= $executionTimeMs ?>ms</strong>.
          </div>
        </div>
      <?php else: ?>
        <div class="status-banner danger">
          <div class="status-icon">⚠️</div>
          <div>
            <strong style="font-size:16px;">SMTP DISPATCH FAILED</strong><br>
            <?= htmlspecialchars($errorMessage) ?>
          </div>
        </div>
      <?php endif; ?>
    <?php else: ?>
      <div class="status-banner info">
        <div class="status-icon">ℹ️</div>
        <div>
          <strong style="font-size:16px;">Gateway Diagnostic Loaded</strong><br>
          SMTP credentials and host configuration loaded from <code>.env</code>. Click <strong>"Send Test Verification Email"</strong> below to test live transmission.
        </div>
      </div>
    <?php endif; ?>

    <!-- Configuration Matrix -->
    <div class="card">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #ffffff;">Active Mailer Configuration</h3>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--muted);">
        Loaded from <code>.env</code> file or server environment variables:
      </p>

      <div class="config-grid">
        <div class="config-item">
          <div class="config-label">SMTP Host (MAIL_HOST)</div>
          <div class="config-value"><?= htmlspecialchars($config['host']) ?></div>
        </div>
        <div class="config-item">
          <div class="config-label">Port &amp; Encryption</div>
          <div class="config-value"><?= htmlspecialchars((string)$config['port']) ?> &bull; <?= strtoupper(htmlspecialchars($config['encryption'])) ?></div>
        </div>
        <div class="config-item">
          <div class="config-label">SMTP Username (MAIL_USERNAME)</div>
          <div class="config-value"><?= htmlspecialchars($config['username']) ?></div>
        </div>
        <div class="config-item">
          <div class="config-label">SMTP Password (MAIL_PASSWORD)</div>
          <div class="config-value"><?= $maskedPassword ?></div>
        </div>
        <div class="config-item">
          <div class="config-label">From Sender (MAIL_FROM_ADDRESS)</div>
          <div class="config-value"><?= htmlspecialchars($config['from_name']) ?> &lt;<?= htmlspecialchars($config['from_address']) ?>&gt;</div>
        </div>
        <div class="config-item">
          <div class="config-label">Test Recipient (FORM_SUBMISSION_TO)</div>
          <div class="config-value"><?= htmlspecialchars($toAddress) ?></div>
        </div>
      </div>

      <?php if (!$hasPassword): ?>
        <div class="tip-box">
          <strong>Next Step on Plesk Server:</strong><br>
          Create or edit the <code>.env</code> file in your <code>httpdocs</code> folder and set your Plesk mailbox password:<br>
          <code style="display:block;margin-top:6px;background:#020617;padding:8px 12px;border-radius:4px;color:#38bdf8;">MAIL_PASSWORD="your_actual_mailbox_password"</code>
        </div>
      <?php endif; ?>

      <form method="POST" action="test-mail.php?key=<?= urlencode($providedKey) ?>" class="btn-group">
        <input type="hidden" name="action" value="send">
        <input type="hidden" name="key" value="<?= htmlspecialchars($providedKey) ?>">
        <button type="submit" class="btn">🚀 Send Test Verification Email</button>
        <a href="test-mail.php?key=<?= urlencode($providedKey) ?>&format=json" class="btn btn-secondary" target="_blank">📄 View JSON Response</a>
        <a href="index.html#careers" class="btn btn-secondary">← Back to Careers Form</a>
      </form>

      <div style="margin-top:22px;padding-top:16px;border-top:1px solid var(--border);">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Quick Test Server &amp; Driver Presets:</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="test-mail.php?key=<?= urlencode($providedKey) ?>&send=1&host=mail.accu20.com&port=587&enc=tls" class="btn" style="background:#0284c7;font-size:12px;padding:7px 14px;">🚀 mail.accu20.com : 587 (TLS)</a>
          <a href="test-mail.php?key=<?= urlencode($providedKey) ?>&send=1&host=mail.accu20.com&port=465&enc=ssl" class="btn btn-secondary" style="font-size:12px;padding:7px 12px;">⚡ mail.accu20.com : 465 (SSL)</a>
          <a href="test-mail.php?key=<?= urlencode($providedKey) ?>&send=1&host=mail.accu20.com&port=25&enc=none" class="btn btn-secondary" style="font-size:12px;padding:7px 12px;">⚡ mail.accu20.com : 25</a>
          <a href="test-mail.php?key=<?= urlencode($providedKey) ?>&send=1&mailer=mail" class="btn btn-secondary" style="font-size:12px;padding:7px 12px;">✉️ Native mail()</a>
        </div>
      </div>
    </div>

    <!-- SMTP Handshake Log (only shown when send was attempted) -->
    <?php if ($testExecuted): ?>
      <div class="card">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #ffffff;">SMTP Connection &amp; Handshake Trace</h3>
        <?php if (empty($debugLogs)): ?>
          <p style="color: var(--muted); font-size: 13px; margin: 0;">No handshake logs recorded (authentication was halted before socket connection).</p>
        <?php else: ?>
          <div class="log-box">
            <?php foreach ($debugLogs as $log): ?>
              <?php
                $msg = $log['message'];
                $cls = 'log-line';
                if (str_starts_with($msg, 'SERVER -> CLIENT:')) $cls .= ' smtp-in';
                elseif (str_starts_with($msg, 'CLIENT -> SERVER:')) $cls .= ' smtp-out';
                elseif (stripos($msg, 'error') !== false || stripos($msg, 'failed') !== false) $cls .= ' smtp-err';
              ?>
              <div class="<?= $cls ?>"><?= htmlspecialchars($msg) ?></div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
