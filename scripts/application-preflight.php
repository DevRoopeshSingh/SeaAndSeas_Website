<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../includes/application_bootstrap.php';
try {
    if(version_compare(PHP_VERSION,'8.2','<'))throw new RuntimeException('PHP 8.2 or newer is required.');
    foreach(['pdo_sqlite','dom','zip','fileinfo','mbstring']as$extension)if(!extension_loaded($extension))throw new RuntimeException('Enable PHP extension: '.$extension);
    $schema=app_schema();$template=__DIR__.'/../'.$schema['template'];
    if(!is_file($template)||!hash_equals($schema['sha256'],hash_file('sha256',$template)))throw new RuntimeException('Original template missing or changed. Reinspect mapping before replacing it.');
    $zip=new ZipArchive();if($zip->open($template)!==true)throw new RuntimeException('Template ZIP cannot open.');
    $doc=new DOMDocument();if(!$doc->loadXML($zip->getFromName('word/document.xml'),LIBXML_NONET))throw new RuntimeException('Template XML cannot parse.');$zip->close();
    $tables=iterator_to_array($doc->getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','tbl'));
    if(count($tables)!==12)throw new RuntimeException('Template tables changed.');
    if(!in_array('--template-only',$argv,true)){
        $hash=get_env_var('ADMIN_PASSWORD_HASH');
        if(!get_env_var('ADMIN_USERNAME')||!$hash||password_get_info($hash)['algo']===null)throw new RuntimeException('Configure ADMIN_USERNAME and a real ADMIN_PASSWORD_HASH.');
        app_db();
        echo "Private storage and additive database migration: OK\n";
    }
    echo "PHP extensions, original template fingerprint and 12 tables: OK\n";
} catch(Throwable $e){
    fwrite(STDERR,'Preflight failed: '.($e instanceof AppConfigurationException?'['.$e->configurationCode.'] ':'').$e->getMessage().PHP_EOL);
    // CLI output stays private. Database diagnostics exclude paths and SQL values.
    $cause=$e instanceof AppConfigurationException?$e->getPrevious():null;
    if($cause instanceof PDOException){
        fwrite(STDERR,'SQLite SQLSTATE: '.$cause->getCode().'; driver code: '.($cause->errorInfo[1]??'unknown').PHP_EOL);
    }
    exit(1);
}
