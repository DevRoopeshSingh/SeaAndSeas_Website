<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../includes/application_bootstrap.php';

// Local development only. Production credentials must be configured privately
// using the hosting account and a permanent outside-web-root storage directory.
try {
    if(!in_array('--local',$argv,true))throw new RuntimeException('Run with --local for localhost development only.');
    $environment=get_env_var('APP_ENV');
    if($environment && $environment!=='local')throw new RuntimeException('Existing non-local configuration was preserved. Configure production credentials privately; do not run local setup on hosting.');
    $hash=get_env_var('ADMIN_PASSWORD_HASH');
    if($hash && password_get_info($hash)['algo']===null)throw new RuntimeException('Existing ADMIN_PASSWORD_HASH is invalid. Correct it privately before setup; it was not overwritten.');
    $settings=[];
    if(!$environment)$settings['APP_ENV']='local';
    $username=get_env_var('ADMIN_USERNAME');
    if(!$username)$settings['ADMIN_USERNAME']=$username='crewing';
    $password=null;
    if(!$hash){
        $password=bin2hex(random_bytes(16));
        $settings['ADMIN_PASSWORD_HASH']=password_hash($password,PASSWORD_DEFAULT);
    }
    if(!get_env_var('APPLICATION_PRIVATE_DIR')){
        $settings['APPLICATION_PRIVATE_DIR']=rtrim(sys_get_temp_dir(),'/\\').'/seaandseas-local-'.substr(hash('sha256',realpath(__DIR__.'/..')),0,12);
    }
    foreach($settings as $key=>$value)putenv($key.'='.$value);
    // Verify storage before writing configuration; never place it in the site.
    app_db();
    if($settings){
        $envPath=__DIR__.'/../.env';
        foreach([$envPath,__DIR__.'/../includes/.env',dirname(__DIR__,2).'/.env'] as $candidate){
            if(is_file($candidate)&&is_readable($candidate)){$envPath=$candidate;break;}
        }
        $content=is_file($envPath)?file_get_contents($envPath):'';
        if($content===false)throw new RuntimeException('Cannot read existing .env.');
        foreach($settings as $key=>$value){
            if(strpbrk($value,"\r\n'\"")!==false)throw new RuntimeException('Configuration contains unsupported characters. Set it privately in .env.');
            $line=$key."='".$value."'";
            $pattern='/^\h*'.preg_quote($key,'/').'\h*=.*$/m';
            if(preg_match($pattern,$content))$content=preg_replace_callback($pattern,static fn()=>$line,$content);
            else $content=rtrim($content,"\r\n").PHP_EOL.$line.PHP_EOL;
        }
        $temporary=tempnam(dirname($envPath),'.env-local-');
        if($temporary===false)throw new RuntimeException('Cannot prepare local configuration.');
        try {
            if(file_put_contents($temporary,$content,LOCK_EX)!==strlen($content)||!chmod($temporary,0600)||!rename($temporary,$envPath))throw new RuntimeException('Cannot save local configuration.');
        } finally {if(is_file($temporary))unlink($temporary);}
    }
    echo "Local admin configuration ready. Existing mail settings and staff credentials were preserved.\n";
    echo 'Username: '.$username.PHP_EOL;
    echo $password?'New password (shown only now): '.$password.PHP_EOL:"Password: use your existing staff password.\n";
    echo "Use http://127.0.0.1:8000/admin with the PHP development server.\n";
    echo "Local temporary storage can be cleared by the OS. Use a permanent private path for real applications.\n";
} catch(Throwable $e){fwrite(STDERR,'Local setup failed: '.$e->getMessage().PHP_EOL);exit(1);}
