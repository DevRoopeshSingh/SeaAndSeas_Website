<?php
declare(strict_types=1);
require_once __DIR__.'/includes/application_bootstrap.php';
try {
    $route=trim($_GET['route']??'', '/');$method=$_SERVER['REQUEST_METHOD'];
    if(str_starts_with($route,'admin/')){
        $hash=get_env_var('ADMIN_PASSWORD_HASH');
        if(!get_env_var('ADMIN_USERNAME')||!$hash||password_get_info($hash)['algo']===null)app_json(['success'=>false,'error'=>'Staff sign-in has not been configured. Contact the site administrator to complete the private server setup.'],503);
        if(!get_env_var('APPLICATION_PRIVATE_DIR'))app_json(['success'=>false,'error'=>'Private application storage has not been configured. Contact the site administrator to complete the server setup.'],503);
    }
    $db=app_db();
    $body=[];
    if($method==='POST'){
        $raw=file_get_contents('php://input',false,null,0,8193);
        if(strlen($raw)>8192)app_json(['success'=>false,'error'=>'Request too large.'],413);
        try{$body=json_decode($raw,true,16,JSON_THROW_ON_ERROR);}catch(Throwable){app_json(['success'=>false,'error'=>'Invalid JSON request.'],400);}
        if(!is_array($body))app_json(['success'=>false,'error'=>'Invalid request.'],400);
    }
    if($route==='admin/login'&&$method==='POST'){
        app_rate('login',10,900);app_session();
        $username=get_env_var('ADMIN_USERNAME');$hash=get_env_var('ADMIN_PASSWORD_HASH');
        if(!$username||!$hash)app_json(['success'=>false,'error'=>'Staff sign-in has not been configured.'],503);
        if(!is_string($body['username']??null)||!is_string($body['password']??null)||!hash_equals($username,$body['username'])||!password_verify($body['password'],$hash))app_json(['success'=>false,'error'=>'Invalid staff credentials.'],401);
        session_regenerate_id(true);$_SESSION=['staff'=>$username,'expires'=>time()+8*3600,'csrf'=>bin2hex(random_bytes(32))];
        app_audit($db,null,'staff_login',$username);app_json(['success'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    $staff=app_admin();
    if($route==='admin/me'&&$method==='GET')app_json(['success'=>true,'user'=>$staff,'role'=>'crewing_officer','csrf'=>$_SESSION['csrf']]);
    if($method==='POST')app_csrf();
    if($route==='admin/logout'&&$method==='POST'){$_SESSION=[];session_destroy();app_json(['success'=>true]);}
    if($route==='admin/applications'&&$method==='GET'){
        $where='1=1';$args=[];
        $search=substr((string)($_GET['search']??''),0,120);
        if($search!==''){$where.=' AND (ref_number LIKE ? OR full_name LIKE ? OR email LIKE ? OR indos_number LIKE ?)';$args=array_fill(0,4,'%'.$search.'%');}
        foreach(['rank'=>'position_applied','status'=>'status']as$key=>$column)if(!empty($_GET[$key])){$where.=' AND '.$column.'=?';$args[]=substr((string)$_GET[$key],0,120);}
        $s=$db->prepare('SELECT COUNT(*) FROM applications WHERE '.$where);$s->execute($args);$total=(int)$s->fetchColumn();
        $limit=max(1,min(100,(int)($_GET['limit']??50)));$offset=max(0,(int)($_GET['offset']??0));
        $s=$db->prepare('SELECT * FROM applications WHERE '.$where.' ORDER BY submitted_at DESC LIMIT '.$limit.' OFFSET '.$offset);$s->execute($args);
        $items=array_map('app_admin_record',$s->fetchAll());app_json(['success'=>true,'items'=>$items,'total'=>$total,'limit'=>$limit,'offset'=>$offset]);
    }
    if(preg_match('~^admin/applications/([a-f0-9]{32})(?:/(status|download)/(docx|cv))?$~D',$route,$m)){
        $s=$db->prepare('SELECT * FROM applications WHERE id=?');$s->execute([$m[1]]);$record=$s->fetch();if(!$record)app_json(['success'=>false,'error'=>'Application not found.'],404);
        if(empty($m[2])&&$method==='GET'){
            app_audit($db,$record['id'],'staff_view',$staff);$detail=app_admin_record($record);$detail['rawData']=json_decode($record['data_json'],true,512,JSON_THROW_ON_ERROR);app_json(['success'=>true,'application'=>$detail]);
        }
        if(($m[2]??'')==='download'&&$method==='GET'){
            if(in_array($record['status'],['processing','failed'],true))app_json(['success'=>false,'error'=>'Application document is not completed.'],409);
            app_audit($db,$record['id'],'staff_download_'.$m[3],$staff);app_stream($record,$m[3]);
        }
    }
    if(preg_match('~^admin/applications/([a-f0-9]{32})/status$~D',$route,$m)&&$method==='POST'){
        $status=$body['status']??'';if(!in_array($status,['submitted','under_review','shortlisted','rejected'],true))app_json(['success'=>false,'error'=>'Invalid review status.'],422);
        $db->beginTransaction();$s=$db->prepare("UPDATE applications SET status=?,updated_at=? WHERE id=? AND status NOT IN ('processing','failed')");$s->execute([$status,gmdate('c'),$m[1]]);
        if(!$s->rowCount()){$db->rollBack();app_json(['success'=>false,'error'=>'A completed application is required.'],409);}
        app_audit($db,$m[1],'status_'.$status,$staff);$db->commit();app_json(['success'=>true]);
    }
    app_json(['success'=>false,'error'=>'Endpoint not found.'],404);
}catch(Throwable $e){
    if(isset($db)&&$db->inTransaction())$db->rollBack();
    if($e instanceof AppConfigurationException){
        error_log('Application API configuration error: '.$e->configurationCode);
        app_json(['success'=>false,'error'=>$e->getMessage(),'code'=>$e->configurationCode],503);
    }
    error_log('Application API error: '.get_class($e));
    app_json(['success'=>false,'error'=>'Application service unavailable. Check server configuration.'],503);
}
function app_admin_record(array $r): array {
    return ['id'=>$r['id'],'refNumber'=>$r['ref_number'],'fullName'=>$r['full_name'],'positionApplied'=>$r['position_applied'],'email'=>$r['email'],'phone'=>$r['phone'],'indosNumber'=>$r['indos_number'],'status'=>$r['status'],'submittedAt'=>$r['submitted_at'],'updatedAt'=>$r['updated_at'],'cvOriginalName'=>$r['cv_name'],'cvSizeKb'=>round(($r['cv_size']??0)/1024),'hasDocx'=>!empty($r['docx_path'])];
}
