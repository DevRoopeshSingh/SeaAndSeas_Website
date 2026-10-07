<?php
declare(strict_types=1);
require_once __DIR__ . '/mailer.php';
load_env_file();
date_default_timezone_set('UTC');
ini_set('display_errors', '0');
umask(0077);

// Only fixed configuration messages may reach an unauthenticated API response.
// Never include filesystem paths, credentials, SQL or the underlying exception text.
class AppConfigurationException extends RuntimeException {
    public function __construct(public readonly string $configurationCode, string $message, ?Throwable $previous=null) {
        parent::__construct($message,0,$previous);
    }
}
function app_configuration_failure(string $code,string $message,?Throwable $previous=null): never {
    throw new AppConfigurationException($code,$message,$previous);
}

function app_schema(): array {
    static $schema;
    return $schema ??= json_decode(file_get_contents(__DIR__.'/../js/application-schema.json'), true, 512, JSON_THROW_ON_ERROR);
}
function app_today(): string { return (new DateTimeImmutable('now',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d'); }
function app_root(): string {
    static $root;
    if ($root) return $root;
    $configured = get_env_var('APPLICATION_PRIVATE_DIR');
    $absolute=PHP_OS_FAMILY==='Windows'
        ? $configured && preg_match('~^[A-Za-z]:[\\\\/]~',$configured)
        : $configured && str_starts_with($configured,'/');
    if (!$absolute) app_configuration_failure('private_storage_path_invalid','Configure APPLICATION_PRIVATE_DIR as an absolute path for this server OS, outside the web root. Do not use a local development path.');
    if (!is_dir($configured) && !mkdir($configured, 0700, true)) app_configuration_failure('private_storage_unavailable','Private application storage cannot be created or accessed. Check the folder, open_basedir and site account permissions.');
    $resolved = str_replace('\\', '/', realpath($configured) ?: '');
    if ($resolved === '') app_configuration_failure('private_storage_unavailable','Private application storage cannot be resolved. Check the folder, open_basedir and site account permissions.');
    $web = str_replace('\\', '/', realpath(__DIR__.'/..'));
    $documentRoot = str_replace('\\', '/', realpath($_SERVER['DOCUMENT_ROOT'] ?? $web) ?: $web);
    foreach ([$web,$documentRoot] as $public) {
        $candidate = PHP_OS_FAMILY === 'Windows' ? strtolower($resolved) : $resolved;
        $public = PHP_OS_FAMILY === 'Windows' ? strtolower($public) : $public;
        if ($candidate === $public || str_starts_with($candidate, rtrim($public,'/').'/')) app_configuration_failure('private_storage_public','Private application storage must be outside the document root. Configure a private folder before using the application service.');
    }
    if (!is_writable($resolved)) app_configuration_failure('private_storage_not_writable','Private application storage is not writable. Grant the site PHP account access to the private folder.');
    foreach (['files','sessions'] as $dir) {
        $directory=$resolved.'/'.$dir;
        if (!is_dir($directory) && !mkdir($directory,0700)) app_configuration_failure('private_subdirectory_unavailable','Private application files or sessions cannot be created. Check the site PHP account permissions.');
        if (!is_writable($directory)) app_configuration_failure('private_subdirectory_not_writable','Private application files or sessions are not writable. Check the site PHP account permissions.');
    }
    return $root = $resolved;
}
function app_db(): PDO {
    static $db;
    if ($db) return $db;
    if (!extension_loaded('pdo_sqlite')) app_configuration_failure('sqlite_driver_unavailable','Enable PDO SQLite for the PHP handler serving this website.');
    $root=app_root();
    $migration=__DIR__.'/../migrations/001_applications.sql';
    if (!is_file($migration)||!is_readable($migration)) app_configuration_failure('database_migration_missing','The application database migration is missing or unreadable. Upload migrations/001_applications.sql and check site account access.');
    $sql=file_get_contents($migration);
    if ($sql===false||trim($sql)==='') app_configuration_failure('database_migration_missing','The application database migration cannot be read. Upload migrations/001_applications.sql and check site account access.');
    try {
        $connection=new PDO('sqlite:'.$root.'/applications.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    } catch (PDOException $e) {
        app_configuration_failure('database_open_failed','The private application database cannot be opened. Check the private folder and database permissions for the site PHP account.',$e);
    }
    try {
        $connection->exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
        $connection->exec($sql);
    } catch (PDOException $e) {
        app_configuration_failure('database_initialize_failed','The private application database cannot be initialized. Check database and journal permissions, disk space and the deployed migration. Run server preflight for details.',$e);
    }
    return $db=$connection;
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
