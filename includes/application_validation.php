<?php
declare(strict_types=1);
function app_text(mixed $value, int $max, string $key, array &$errors): string {
    if (!is_string($value) || !mb_check_encoding($value,'UTF-8')) {$errors[$key]='Enter valid text.';return '';}
    $value=trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{FFFE}\x{FFFF}]/u','',$value));
    if (mb_strlen($value)>$max) $errors[$key]='Use no more than '.$max.' characters.';
    return $value;
}
function app_date(string $v): bool {
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$v);
    return $date && $date->format('Y-m-d')===$v && $v>='1900-01-01' && $v<='2200-12-31';
}
function app_validate_value(string $v, array $spec, string $key, array &$errors): void {
    if ($v==='') return;
    $valid=match($spec['type']??'text') {
        'date'=>app_date($v),
        'email'=>(bool)filter_var($v,FILTER_VALIDATE_EMAIL),
        'phone'=>(bool)preg_match('/^\+?[0-9 ()-]{7,25}$/D',$v) && strlen(preg_replace('/\D/','',$v))>=7 && strlen(preg_replace('/\D/','',$v))<=15,
        'number','integer'=>is_numeric($v) && (!isset($spec['min'])||(float)$v>=$spec['min']) && (!isset($spec['maxNumber'])||(float)$v<=$spec['maxNumber']) && (($spec['type']!=='integer')||ctype_digit($v)),
        'ifsc'=>(bool)preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/D',$v),
        'bank_code'=>(bool)preg_match('/^(?:[A-Z]{4}0[A-Z0-9]{6}|[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)$/D',$v),
        'account'=>(bool)preg_match('/^[A-Z0-9 -]{5,34}$/Di',$v),
        'consent'=>in_array($v,['on','true','1'],true),
        default=>true
    };
    if (!$valid) $errors[$key]='Enter a valid '.$spec['label'].'.';
    if (isset($spec['enum']) && !in_array($v,$spec['enum'],true)) $errors[$key]='Choose a listed answer.';
}
function app_validate(array $input): array {
    $schema=app_schema();$errors=[];$data=[];
    foreach ($schema['fields'] as $key=>$spec) {
        $v=app_text($input[$key]??'', $spec['max'], $key,$errors);
        if (($spec['required']||isset($spec['when']) && ($input[$spec['when'][0]]??'')===$spec['when'][1]) && $v==='') $errors[$key]='This field is required.';
        app_validate_value($v,$spec,$key,$errors);$data[$key]=$v;
    }
    $data['email']=strtolower($data['email']);
    foreach ($schema['repeats'] as $group=>$spec) {
        try {$entries=json_decode($input[$spec['key']]??'[]',true,32,JSON_THROW_ON_ERROR);}catch(Throwable){$entries=null;}
        if (!is_array($entries)||!array_is_list($entries)||count($entries)>$spec['max']) {$errors[$spec['key']]='Enter up to '.$spec['max'].' valid records.';$entries=[];}
        $data[$spec['key']]=[];
        foreach ($entries as $i=>$entry) {
            if (!is_array($entry)) {$errors[$spec['key']]='Invalid record.';continue;}
            $row=[];
            foreach ($spec['fields'] as $key) {
                $path=$spec['key'].'.'.$i.'.'.$key;$v=app_text($entry[$key]??'',120,$path,$errors);
                $type=preg_match('/_(doi|doe|dob|anniv|from|to)$/',$key)?'date':'text';
                if (in_array($key,['sea_grt','sea_dwt','sea_bhp','sea_built'],true)) $type='integer';
                app_validate_value($v,['type'=>$type,'min'=>$key==='sea_built'?1800:0,'maxNumber'=>$key==='sea_built'?(int)date('Y'):10000000,'label'=>str_replace('_',' ',$key)],$path,$errors);
                $row[$key]=$v;
            }
            $required=$spec['required']??match($group){'family'=>['fam_rel','fam_name'],'education'=>['edu_school','edu_degree'],'sea_service'=>['sea_owner','sea_vessel','sea_rank','sea_from','sea_to'],'visas'=>['visa_name'],'certificates'=>['certificate_name','certificate_no'],default=>[]};
            foreach($required as $k)if($row[$k]==='')$errors[$spec['key'].'.'.$i.'.'.$k]='Complete this record or remove it.';
            foreach([['fam_doi','fam_doe'],['edu_from','edu_to'],['visa_doi','visa_doe'],['certificate_doi','certificate_doe'],['licence_doi','licence_doe'],['sea_from','sea_to']]as[$from,$to])if(!empty($row[$from])&&!empty($row[$to])&&$row[$from]>$row[$to])$errors[$spec['key'].'.'.$i.'.'.$to]='End or expiry date must be after the start or issue date.';
            if ($group==='sea_service' && app_date($row['sea_from']) && app_date($row['sea_to'])) {
                $interval=(new DateTimeImmutable($row['sea_from']))->diff(new DateTimeImmutable($row['sea_to']));
                $row['sea_total']=($interval->y*12+$interval->m).'M '.$interval->d.'D';
                if($row['sea_to']>app_today())$errors[$spec['key'].'.'.$i.'.sea_to']='Sign-off cannot be in the future.';
            }
            if($group==='family' && $row['fam_ecnr']!=='' && !in_array($row['fam_ecnr'],['YES','NO'],true))$errors[$spec['key'].'.'.$i.'.fam_ecnr']='Choose YES or NO.';
            if($group==='family' && $row['fam_dob']!=='' && $row['fam_dob']>=app_today())$errors[$spec['key'].'.'.$i.'.fam_dob']='Birth date must be in the past.';
            $data[$spec['key']][]=$row;
        }
    }
    foreach($data as $key=>$v)if(is_string($v)) {
        if(str_ends_with($key,'_doi'))$to=substr($key,0,-4).'_doe';elseif(str_ends_with($key,'_from'))$to=substr($key,0,-5).'_to';else continue;
        if($v!==''&&!empty($data[$to])&&$v>$data[$to])$errors[$to]='Expiry/end must be after issue/start.';
    }
    if ($data['dob']>=app_today())$errors['dob']='Birth date must be in the past.';
    if ($data['signature_date']>app_today())$errors['signature_date']='Signature date cannot be in the future.';
    if(mb_strtolower($data['digital_signature_name'])!==mb_strtolower($data['full_name']))$errors['digital_signature_name']='Type the same full name as your personal details.';
    if($data['us_visa_type']!==''&&$data['us_visa_type']!=='None')foreach(['us_visa_doi','us_visa_doe','us_visa_poi','us_visa_no']as$k)if($data[$k]==='')$errors[$k]='Complete your U.S. visa details.';
    if($data['nri_account_no']!=='')foreach(['nri_account_type','nri_holder_name','nri_bank_name','nri_ifsc_swift']as$k)if($data[$k]==='')$errors[$k]='Complete your NRI account details.';
    return [$data,$errors];
}
function app_validate_upload(array $file): string {
    if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name']??'')) throw new InvalidArgumentException('Attach a valid CV file (maximum 10 MB).');
    if(($file['size']??0)<1 || $file['size']>10*1024*1024)throw new InvalidArgumentException('CV must be between 1 byte and 10 MB.');
    $ext=strtolower(pathinfo($file['name'],PATHINFO_EXTENSION));$head=file_get_contents($file['tmp_name'],false,null,0,8);
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if($ext==='pdf'&&str_starts_with($head,'%PDF-')&&$mime==='application/pdf')return $ext;
    if($ext==='doc'&&str_starts_with($head,"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")&&in_array($mime,['application/msword','application/x-ole-storage','application/CDFV2'],true))return $ext;
    if($ext==='docx'&&str_starts_with($head,'PK')){
        $z=new ZipArchive();if($z->open($file['tmp_name'])===true){$size=0;$valid=true;
            for($i=0;$i<$z->numFiles;$i++){$s=$z->statIndex($i);$size+=$s['size'];if(str_contains($s['name'],'vbaProject')||str_contains($s['name'],'../'))$valid=false;}
            $valid=$valid&&$size<50*1024*1024&&$z->locateName('word/document.xml')!==false&&$z->locateName('[Content_Types].xml')!==false;$z->close();if($valid)return $ext;
        }
    }
    throw new InvalidArgumentException('Upload an authentic PDF, DOC or DOCX file matching its extension.');
}
