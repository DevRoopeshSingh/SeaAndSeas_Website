<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../includes/application_bootstrap.php';
if(get_env_var('APPLICATION_EMAIL_ENABLED','false')!=='true'){echo "Application email notifications are disabled.\n";exit;}
$db=app_db();
// Serialize workers. Delivery is at-least-once if the process stops after SMTP acceptance.
$lock=fopen(app_root().'/notifications.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit;
$pending=$db->query('SELECT n.application_id,a.ref_number FROM application_notifications n JOIN applications a ON a.id=n.application_id WHERE n.sent_at IS NULL AND n.attempts<10 ORDER BY a.submitted_at LIMIT 20')->fetchAll();
foreach($pending as$r){
    $db->prepare('UPDATE application_notifications SET attempts=attempts+1 WHERE application_id=?')->execute([$r['application_id']]);
    try{
        $config=get_mailer_config();$mail=create_smtp_mailer(false,null,$config);$mail->addAddress($config['to_address']);
        $mail->Subject='New seafarer application '.$r['ref_number'];
        $mail->Body='Application '.$r['ref_number'].' is complete. Sign in to the Sea & Seas staff portal to view the bio-data, CV and completed DOCX. No private applicant information is included in this notification.';
        $mail->isHTML(false);$mail->send();
        $db->prepare('UPDATE application_notifications SET sent_at=? WHERE application_id=?')->execute([gmdate('c'),$r['application_id']]);app_audit($db,$r['application_id'],'notification_sent','system');
    }catch(Throwable){app_audit($db,$r['application_id'],'notification_failed','system');}
}
flock($lock,LOCK_UN);fclose($lock);
