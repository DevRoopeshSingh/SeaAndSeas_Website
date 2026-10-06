<?php
declare(strict_types=1);
require_once __DIR__ . '/mailer.php';
load_env_file();
date_default_timezone_set('UTC');
ini_set('display_errors', '0');
umask(0077);

function app_schema(): array {
    static $schema;
    return $schema ??= json_decode(file_get_contents(__DIR__.'/../js/application-schema.json'), true, 512, JSON_THROW_ON_ERROR);
}
function app_today(): string { return (new DateTimeImmutable('now',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d'); }
function app_root(): string {
    static $root;
    if ($root) return $root;
    $configured = get_env_var('APPLICATION_PRIVATE_DIR');
    if (!$configured || !preg_match('~^(?:/|[A-Za-z]:[\\\\/])~', $configured)) throw new RuntimeException('Configure absolute APPLICATION_PRIVATE_DIR outside the web root.');
    if (!is_dir($configured) && !mkdir($configured, 0700, true)) throw new RuntimeException('Private storage unavailable.');
    $resolved = str_replace('\\', '/', realpath($configured) ?: '');
    if ($resolved === '') throw new RuntimeException('Private storage unavailable.');
    $web = str_replace('\\', '/', realpath(__DIR__.'/..'));
    $documentRoot = str_replace('\\', '/', realpath($_SERVER['DOCUMENT_ROOT'] ?? $web) ?: $web);
    foreach ([$web,$documentRoot] as $public) {
        $candidate = PHP_OS_FAMILY === 'Windows' ? strtolower($resolved) : $resolved;
        $public = PHP_OS_FAMILY === 'Windows' ? strtolower($public) : $public;
        if ($candidate === $public || str_starts_with($candidate, rtrim($public,'/').'/')) throw new RuntimeException('Storage must be outside the document root.');
    }
    if (!is_writable($resolved)) throw new RuntimeException('Private storage is not writable.');
    foreach (['files','sessions'] as $dir) if (!is_dir($resolved.'/'.$dir) && !mkdir($resolved.'/'.$dir,0700)) throw new RuntimeException('Private directory unavailable.');
    return $root = $resolved;
}
function app_db(): PDO {
    static $db;
    if ($db) return $db;
    $db = new PDO('sqlite:'.app_root().'/applications.sqlite', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    $db->exec(file_get_contents(__DIR__.'/../migrations/001_applications.sql'));
    return $db;
}
function app_audit(PDO $db, ?string $id, string $event, string $actor='applicant'): void {
    $db->prepare('INSERT INTO application_audit(application_id,event,actor,created_at) VALUES(?,?,?,?)')->execute([$id,$event,$actor,gmdate('c')]);
}
function app_json(array $body, int $status=200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    echo json_encode($body, JSON_THROW_ON_ERROR); exit;
}
function app_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode','1');
    ini_set('session.use_only_cookies','1');
    session_save_path(app_root().'/sessions');
    session_name('SS_APPLICATION_SESSION');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>get_env_var('APP_ENV','production') !== 'local','httponly'=>true,'samesite'=>'Strict']);
    session_start();
}
function app_admin(): string {
    app_session();
    if (empty($_SESSION['staff']) || ($_SESSION['expires']??0)<time()) app_json(['success'=>false,'error'=>'Staff sign-in required.'],401);
    return $_SESSION['staff'];
}
function app_csrf(): void {
    if (!hash_equals($_SESSION['csrf']??'', $_SERVER['HTTP_X_CSRF_TOKEN']??'') || empty($_SESSION['csrf'])) app_json(['success'=>false,'error'=>'Please refresh and sign in again.'],403);
}
function app_rate(string $action, int $max, int $seconds): void {
    $db=app_db();
    $bucket=hash('sha256',$action.':'.($_SERVER['REMOTE_ADDR']??'unknown'));
    $db->exec('DELETE FROM rate_limits WHERE expires < '.time());
    $db->prepare('INSERT INTO rate_limits(bucket,attempts,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1')->execute([$bucket,time()+$seconds]);
    $s=$db->prepare('SELECT attempts FROM rate_limits WHERE bucket=?');$s->execute([$bucket]);
    if ((int)$s->fetchColumn()>$max) app_json(['success'=>false,'error'=>'Too many attempts. Please try again later.'],429);
}
function app_file(string $relative): string {
    if (!preg_match('~^files/[a-f0-9]{32}/(application\.docx|cv\.(pdf|doc|docx))$~D',$relative)) throw new RuntimeException('Invalid private file reference.');
    $path=app_root().'/'.$relative;
    $real = str_replace('\\','/',realpath($path) ?: '');
    $base = app_root().'/files/';
    if(PHP_OS_FAMILY === 'Windows') {$real=strtolower($real);$base=strtolower($base);}
    if (!is_file($path) || !str_starts_with($real,$base)) throw new RuntimeException('Private file unavailable.');
    return $path;
}
function app_stream(array $record, string $type): never {
    $relative=$type==='docx'?$record['docx_path']:$record['cv_path'];
    $path=app_file($relative??'');
    $filename=$type==='docx'?$record['ref_number'].'.docx':preg_replace('/[^a-zA-Z0-9._-]/','_', $record['cv_name']);
    header('Cache-Control: private, no-store');header('Referrer-Policy: no-referrer');header('X-Content-Type-Options: nosniff');
    header('Content-Type: '.($type==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/octet-stream'));
    header('Content-Disposition: attachment; filename="'.$filename.'"');header('Content-Length: '.filesize($path));
    readfile($path);exit;
}
