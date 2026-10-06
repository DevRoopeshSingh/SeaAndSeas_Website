<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../includes/application_bootstrap.php';
$db=app_db();$cutoff=gmdate('c',time()-3600);
$s=$db->prepare("SELECT id FROM applications WHERE status='processing' AND updated_at<?");$s->execute([$cutoff]);
foreach($s->fetchAll()as$r){
    $db->beginTransaction();$u=$db->prepare("UPDATE applications SET status='failed',cv_path=NULL,docx_path=NULL,download_hash=NULL,updated_at=? WHERE id=? AND status='processing' AND updated_at<?");$u->execute([gmdate('c'),$r['id'],$cutoff]);
    if($u->rowCount()){
        $folder=app_root().'/files/'.$r['id'];if(is_dir($folder)){foreach(glob($folder.'/*')as$f)if(is_file($f))unlink($f);rmdir($folder);}
        app_audit($db,$r['id'],'abandoned_processing_recovered','system');
    }$db->commit();
}
echo "Abandoned processing records recovered. Applicants can retry with their original submission key.\n";
