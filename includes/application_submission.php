<?php
declare(strict_types=1);
require_once __DIR__.'/application_bootstrap.php';
require_once __DIR__.'/application_validation.php';
require_once __DIR__.'/application_docx.php';
function app_submission(): never {
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')app_json(['success'=>false,'error'=>'POST required.'],405);
    if(!empty($_POST['_hp_trap']))app_json(['success'=>false,'error'=>'Submission could not be accepted.'],400);
    app_rate('submission',30,3600);
    [$data,$errors]=app_validate($_POST);
    if($errors)app_json(['success'=>false,'error'=>'Please correct the highlighted fields.','errors'=>$errors],422);
    $key=$_SERVER['HTTP_IDEMPOTENCY_KEY']??'';
    if(!preg_match('/^[a-zA-Z0-9-]{32,64}$/D',$key))app_json(['success'=>false,'error'=>'Refresh the application page before submitting.'],400);
    try{$ext=app_validate_upload($_FILES['cv_file']??[]);}catch(InvalidArgumentException $e){app_json(['success'=>false,'error'=>$e->getMessage(),'errors'=>['cv_file'=>$e->getMessage()]],422);}
    $db=app_db();$hash=hash('sha256',$key);
    $payload=hash('sha256',json_encode($data,JSON_THROW_ON_ERROR).hash_file('sha256',$_FILES['cv_file']['tmp_name']));
    $id=null;$folder=null;
    try {
        $db->beginTransaction();$s=$db->prepare('SELECT * FROM applications WHERE idempotency_hash=?');$s->execute([$hash]);$record=$s->fetch();
        if($record){
            if(!hash_equals($record['payload_hash'],$payload)){$db->rollBack();app_json(['success'=>false,'error'=>'This submission key was used for different information. Start a new application.'],409);}
            if($record['status']==='processing'){$db->rollBack();app_json(['success'=>false,'error'=>'Your application is being processed. Please retry shortly.'],409);}
            if($record['status']!=='failed'){
                app_file($record['docx_path']);$token=bin2hex(random_bytes(32));$db->prepare('UPDATE applications SET download_hash=?,download_expires=? WHERE id=?')->execute([hash('sha256',$token),time()+3600,$record['id']]);$db->commit();
                app_json(['success'=>true,'refNumber'=>$record['ref_number'],'downloadUrl'=>'/download_application.php?token='.$token,'downloadExpiresIn'=>3600]);
            }
            $id=$record['id'];$ref=$record['ref_number'];$db->prepare("UPDATE applications SET status='processing',updated_at=? WHERE id=?")->execute([gmdate('c'),$id]);
        }else{
            $id=bin2hex(random_bytes(16));$ref='SS-APP-'.gmdate('Y').'-'.strtoupper(bin2hex(random_bytes(6)));
            $db->prepare("INSERT INTO applications(id,ref_number,full_name,position_applied,email,phone,indos_number,status,schema_version,data_json,idempotency_hash,payload_hash,submitted_at,updated_at) VALUES(?,?,?,?,?,?,?,'processing',1,?,?,?,?,?)")->execute([$id,$ref,$data['full_name'],$data['position_applied'],$data['email'],$data['phone'],$data['indos_number'],json_encode($data,JSON_THROW_ON_ERROR),$hash,$payload,gmdate('c'),gmdate('c')]);
        }
        app_audit($db,$id,'processing');$db->commit();
        $folder=app_root().'/files/'.$id;
        if(!is_dir($folder)&&!mkdir($folder,0700))throw new RuntimeException('Cannot create private application directory.');
        $cv='files/'.$id.'/cv.'.$ext;
        if(!move_uploaded_file($_FILES['cv_file']['tmp_name'],app_root().'/'.$cv))throw new RuntimeException('CV storage failed.');
        app_generate_docx($data,$ref,$folder.'/application.part');
        if(!rename($folder.'/application.part',$folder.'/application.docx'))throw new RuntimeException('Document storage failed.');
        $token=bin2hex(random_bytes(32));$db->beginTransaction();
        $completed=$db->prepare("UPDATE applications SET status='submitted',cv_path=?,cv_name=?,cv_size=?,docx_path=?,download_hash=?,download_expires=?,updated_at=? WHERE id=? AND status='processing'");
        $completed->execute([$cv,basename($_FILES['cv_file']['name']),$_FILES['cv_file']['size'],'files/'.$id.'/application.docx',hash('sha256',$token),time()+3600,gmdate('c'),$id]);
        if($completed->rowCount()!==1)throw new RuntimeException('Application reservation no longer active.');
        app_audit($db,$id,'submitted');
        $db->prepare('INSERT OR IGNORE INTO application_notifications(application_id) VALUES(?)')->execute([$id]);
        $db->commit();
        app_json(['success'=>true,'refNumber'=>$ref,'downloadUrl'=>'/download_application.php?token='.$token,'downloadExpiresIn'=>3600,'message'=>'Application saved and completed Word document generated.']);
    }catch(Throwable $e){
        if($db->inTransaction())$db->rollBack();
        if($folder&&is_dir($folder)){foreach(glob($folder.'/*')as$file)if(is_file($file))unlink($file);rmdir($folder);}
        if($id){$db->prepare("UPDATE applications SET status='failed',cv_path=NULL,docx_path=NULL,download_hash=NULL,updated_at=? WHERE id=? AND status='processing'")->execute([gmdate('c'),$id]);app_audit($db,$id,'generation_or_storage_failed');}
        error_log('Application processing failed ['.($id??'unreserved').']: '.get_class($e));
        app_json(['success'=>false,'error'=>'Your application was not completed. Your form is retained; please retry.'],503);
    }
}
