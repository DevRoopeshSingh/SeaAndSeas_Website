<?php
declare(strict_types=1);
require_once __DIR__.'/includes/application_bootstrap.php';
try {
    $token=$_GET['token']??'';
    if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))app_json(['success'=>false,'error'=>'Invalid download link.'],404);
    $s=app_db()->prepare("SELECT * FROM applications WHERE download_hash=? AND download_expires>? AND status NOT IN ('failed','processing')");$s->execute([hash('sha256',$token),time()]);$record=$s->fetch();
    if(!$record)app_json(['success'=>false,'error'=>'This private download link has expired. Contact the crewing desk with your application number.'],404);
    app_audit(app_db(),$record['id'],'docx_download');app_stream($record,'docx');
}catch(Throwable){app_json(['success'=>false,'error'=>'Document download is unavailable.'],503);}
