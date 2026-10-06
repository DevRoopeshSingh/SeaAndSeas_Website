<?php
// Development router only: php -S 127.0.0.1:8000 scripts/php-router.php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(str_contains($path,'..')||preg_match('~(^|/)\.|^/(includes|phpmailer|lib|data|storage|uploads|applications_archive|tests|scripts|migrations|docs|node_modules)(/|$)~',$path)||preg_match('~\.(docx|sql|sqlite|db|json|env|log|zip)$~',$path)&&$path!=='/js/application-schema.json'||in_array($path,['/server.js','/package.json','/package-lock.json','/test-mail.php'],true)){http_response_code(403);exit;}
if(str_starts_with($path,'/api/')){$_GET['route']=substr($path,5);require __DIR__.'/../api.php';return;}
if($path==='/apply'||$path==='/admin'){header('Content-Type: text/html; charset=utf-8');readfile(__DIR__.'/../'.substr($path,1).'.html');return;}
if($path==='/'){readfile(__DIR__.'/../index.html');return;}
return false;
