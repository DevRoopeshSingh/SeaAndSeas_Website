<?php
/**
 * Sea & Seas Shipping Private Limited
 * SMTP Mailer Helper & Environment Configuration
 *
 * Uses PHPMailer to send authenticated SMTP emails via Plesk mailbox.
 */

declare(strict_types=1);

// Load PHPMailer Classes
require_once __DIR__ . '/../phpmailer/Exception.php';
require_once __DIR__ . '/../phpmailer/PHPMailer.php';
require_once __DIR__ . '/../phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

/**
 * Load environment variables from a .env file if present.
 */
function load_env_file(?string $envPath = null): void {
    $possiblePaths = [];
    if ($envPath !== null) {
        $possiblePaths[] = $envPath;
    }
    $possiblePaths[] = __DIR__ . '/../.env';              // httpdocs/.env
    $possiblePaths[] = __DIR__ . '/.env';                 // includes/.env
    $possiblePaths[] = dirname(__DIR__, 2) . '/.env';     // Above httpdocs (private)

    $resolvedPath = null;
    foreach ($possiblePaths as $path) {
        if (file_exists($path) && is_readable($path)) {
            $resolvedPath = $path;
            break;
        }
    }

    if (!$resolvedPath) {
        return;
    }

    $lines = file($resolvedPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        // Skip comments and empty lines
        if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, ';')) {
            continue;
        }

        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $val = trim($parts[1]);

        // Strip matching outer quotes
        if ((str_starts_with($val, '"') && str_ends_with($val, '"')) ||
            (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
            $val = substr($val, 1, -1);
        }

        // Set in environment
        putenv("{$key}={$val}");
        $_ENV[$key] = $val;
        $_SERVER[$key] = $val;
    }
}

/**
 * Retrieve an environment variable with a fallback default.
 */
function get_env_var(string $key, ?string $default = null): ?string {
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return (string) $val;
    }
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return (string) $_ENV[$key];
    }
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return (string) $_SERVER[$key];
    }
    return $default;
}

/**
 * Get unified mailer configuration.
 *
 * @return array<string, mixed>
 */
function get_mailer_config(): array {
    // Automatically load .env if available
    load_env_file();

    return [
        'mailer'       => strtolower(get_env_var('MAIL_MAILER', 'smtp') ?: 'smtp'),
        'host'         => get_env_var('MAIL_HOST', 'mail.accu20.com'),
        'port'         => (int) (get_env_var('MAIL_PORT', '587') ?: 587),
        'encryption'   => strtolower(get_env_var('MAIL_ENCRYPTION', 'tls') ?: 'tls'),
        'username'     => get_env_var('MAIL_USERNAME', 'website@seasshipping.com'),
        'password'     => get_env_var('MAIL_PASSWORD', ''),
        'from_address' => get_env_var('MAIL_FROM_ADDRESS', 'website@seasshipping.com'),
        'from_name'    => get_env_var('MAIL_FROM_NAME', 'Sea & Seas – Website'),
        'to_address'   => get_env_var('FORM_SUBMISSION_TO', 'ohmeujjawal@gmail.com'),
        'reply_to'     => get_env_var('MAIL_REPLY_TO', 'crewing@seasshipping.com'),
    ];
}

/**
 * Create and configure an authenticated SMTP PHPMailer instance.
 *
 * @param bool $debug Enable verbose SMTP debug logs
 * @param callable|null $debugOutput Custom log collector callback
 * @return PHPMailer
 * @throws Exception
 */
function create_smtp_mailer(bool $debug = false, ?callable $debugOutput = null, ?array $overrideConfig = null): PHPMailer {
    $config = $overrideConfig ?: get_mailer_config();

    $mail = new PHPMailer(true);

    // Check if configured to use PHP native mail()
    $mailerType = strtolower((string)($config['mailer'] ?? get_env_var('MAIL_MAILER', 'smtp')));
    if ($mailerType === 'mail' || strtolower((string)$config['host']) === 'mail') {
        $mail->isMail();
        $mail->UseSendmailOptions = false;
        $mail->Sender = '';
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            @ini_set('sendmail_from', (string)$config['from_address']);
        }
    } else {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = (string) $config['host'];
        $mail->SMTPAuth   = true;
        $mail->AuthType   = 'LOGIN'; // Force standard LOGIN authentication, bypassing broken CRAM-MD5
        $mail->Username   = (string) $config['username'];
        $mail->Password   = (string) $config['password'];
        $mail->CharSet    = 'UTF-8';
        $mail->Timeout    = 25; // 25-second connection timeout

        // Protocol encryption
        $enc = strtolower((string) $config['encryption']);
        $port = (int) $config['port'];

        if ($enc === 'ssl' || ($port === 465 && $enc !== 'none')) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($enc === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPSecure = '';
            $mail->SMTPAutoTLS = false;
        }
        $mail->Port = $port;
    }

    // Resilient SSL stream options for shared hosting environments
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true
        ]
    ];

    // Sender Identity
    $mail->setFrom((string) $config['from_address'], (string) $config['from_name']);

    // Debugging configuration
    if ($debug) {
        $mail->SMTPDebug = SMTP::DEBUG_SERVER;
        if ($debugOutput !== null) {
            $mail->Debugoutput = $debugOutput;
        }
    }

    return $mail;
}
