<?php
declare(strict_types=1);
const APP_WORD_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function app_children(DOMNode $node,string $name): array {
    return array_values(array_filter(iterator_to_array($node->childNodes),fn($n)=>$n->namespaceURI===APP_WORD_NS && $n->localName===$name));
}
function app_doc_text(DOMNode $node): string {
    $out='';foreach($node->ownerDocument->getElementsByTagNameNS(APP_WORD_NS,'t') as $t){
        for($p=$t;$p;$p=$p->parentNode)if($p===$node){$out.=$t->textContent;break;}
    }return $out;
}
function app_write_text(DOMNode $container,string $text): void {
    $doc=$container->ownerDocument;
    $paragraph=$container->localName==='p'?$container:(app_children($container,'p')[0]??null);
    if(!$paragraph)throw new RuntimeException('Template paragraph missing.');
    $run=app_children($paragraph,'r')[0]??null;
    $properties=$run?(app_children($run,'rPr')[0]??null):null;
    if(!$properties){$pPr=app_children($paragraph,'pPr')[0]??null;$properties=$pPr?(app_children($pPr,'rPr')[0]??null):null;}
    $properties=$properties?->cloneNode(true);
    foreach(iterator_to_array($paragraph->childNodes)as$child)if($child->localName!=='pPr')$paragraph->removeChild($child);
    if($container->localName==='tc')foreach(array_slice(app_children($container,'p'),1)as$p)$container->removeChild($p);
    $r=$doc->createElementNS(APP_WORD_NS,'w:r');if($properties)$r->appendChild($properties);
    $t=$doc->createElementNS(APP_WORD_NS,'w:t');$t->setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');$t->appendChild($doc->createTextNode($text));$r->appendChild($t);$paragraph->appendChild($r);
    // Exact template heights can hide multiline data. Keep the original height as a minimum.
    if($container->localName==='tc'){
        $row=$container->parentNode;
        foreach($row->getElementsByTagNameNS(APP_WORD_NS,'trHeight')as$h)if($h->getAttributeNS(APP_WORD_NS,'hRule')==='exact')$h->setAttributeNS(APP_WORD_NS,'w:hRule','atLeast');
        $pr=app_children($row,'trPr')[0]??$doc->createElementNS(APP_WORD_NS,'w:trPr');if(!$pr->parentNode)$row->insertBefore($pr,$row->firstChild);
        if(!app_children($pr,'cantSplit'))$pr->appendChild($doc->createElementNS(APP_WORD_NS,'w:cantSplit'));
    }
}
function app_format_date(string $v): string {return $v!==''?(new DateTimeImmutable($v))->format('d-M-Y'):'';}
function app_fill_slots(DOMNode $paragraph,array $values): void {
    $slot=0;
    foreach($paragraph->getElementsByTagNameNS(APP_WORD_NS,'t')as$t){
        $t->textContent=preg_replace_callback('/_{3,}/',function()use(&$slot,$values){if(!isset($values[$slot]))throw new RuntimeException('Unexpected paragraph slot.');return $values[$slot++];},$t->textContent);
    }
    if($slot!==count($values))throw new RuntimeException('Missing paragraph slots.');
}
function app_generate_docx(array $data,string $ref,string $output): void {
    $schema=app_schema();$template=__DIR__.'/../'.$schema['template'];
    if(!is_file($template)||!hash_equals($schema['sha256'],hash_file('sha256',$template)))throw new RuntimeException('Template fingerprint mismatch. Inspect the mapping before replacement.');
    if(!copy($template,$output))throw new RuntimeException('Cannot stage document.');
    $zip=new ZipArchive();if($zip->open($output)!==true)throw new RuntimeException('Cannot open template archive.');
    try {
        $xml=$zip->getFromName('word/document.xml');$doc=new DOMDocument();
        if(!$doc->loadXML($xml,LIBXML_NONET)||$doc->doctype)throw new RuntimeException('Invalid template XML.');
        $tables=iterator_to_array($doc->getElementsByTagNameNS(APP_WORD_NS,'tbl'));
        if(count($tables)!==12)throw new RuntimeException('Unexpected template tables.');
        $matrix=[];foreach($tables as$t)$matrix[]=array_map(fn($r)=>app_children($r,'tc'),app_children($t,'tr'));
        // The supplied U.S. visa cells are vertical-merge continuations, which Word hides.
        // Split only these four data/header cells so the mapped values are visible.
        foreach([3,4]as$r)for($c=0;$c<4;$c++)foreach(iterator_to_array($matrix[3][$r][$c]->getElementsByTagNameNS(APP_WORD_NS,'vMerge'))as$merge)$merge->parentNode->removeChild($merge);
        foreach([1=>'Date of Issue',2=>'Place of Issue',3=>'Date of Expiry']as$c=>$label)app_write_text($matrix[3][3][$c],$label);
        // The original floating landscape table starts under the header logo.
        // Preserve header parts, widths and orientation; allow the table to flow below it.
        foreach(iterator_to_array($tables[7]->getElementsByTagNameNS(APP_WORD_NS,'tblpPr'))as$p)$p->parentNode->removeChild($p);
        foreach($doc->getElementsByTagNameNS(APP_WORD_NS,'sectPr')as$section){
            $size=app_children($section,'pgSz')[0]??null;
            if($size?->getAttributeNS(APP_WORD_NS,'orient')==='landscape'){
                $margin=app_children($section,'pgMar')[0];$margin->setAttributeNS(APP_WORD_NS,'w:top','1800');$margin->setAttributeNS(APP_WORD_NS,'w:bottom','720');
            }
        }
        $values=[];
        foreach($schema['fields']as$key=>$spec)if(isset($spec['cell'])){
            [$t,$r,$c]=$spec['cell'];if(!isset($matrix[$t][$r][$c]))throw new RuntimeException('Missing mapped cell: '.$key);
            $locator="$t:$r:$c";$v=$data[$key]??'';if($spec['type']==='date')$v=app_format_date($v);
            if(!empty($spec['append'])){if($v!=='')$values[$locator]=trim(($values[$locator]??'').'; '.$v,'; ');}
            else $values[$locator]=($spec['prefix']??'').$v;
        }
        foreach($values as$location=>$v){[$t,$r,$c]=array_map('intval',explode(':',$location));app_write_text($matrix[$t][$r][$c],$v);}
        // Original mappings are resolved before any row insertion shifts indices.
        foreach($schema['repeats']as$group=>$spec){
            $entries=$data[$spec['key']]??[];
            if($group==='certificates' && !empty($data['stcw_offshore_no']))$entries[]=['certificate_name'=>'Combined offshore (as submitted)','certificate_no'=>$data['stcw_offshore_no'],'certificate_doi'=>$data['stcw_offshore_doi'],'certificate_doe'=>$data['stcw_offshore_doe'],'certificate_by'=>$data['stcw_offshore_by']];
            if(count($entries)>$spec['max']+($group==='certificates'?1:0))throw new RuntimeException('Too many repeated records.');
            $table=$tables[$spec['table']];$rows=app_children($table,'tr');
            $sample=$rows[$spec['capacity']?$spec['start']+$spec['capacity']-1:$spec['start']-1];
            $anchor=$rows[$spec['start']+$spec['capacity']]??null;
            for($i=0;$i<max($spec['capacity'],count($entries));$i++){
                if($i<$spec['capacity'])$row=$rows[$spec['start']+$i];else{
                    $row=$sample->cloneNode(true);
                    foreach($row->getElementsByTagNameNS(APP_WORD_NS,'p')as$p)if($p->hasAttributeNS('http://schemas.microsoft.com/office/word/2010/wordml','paraId'))$p->setAttributeNS('http://schemas.microsoft.com/office/word/2010/wordml','w14:paraId',strtoupper(bin2hex(random_bytes(4))));
                    $table->insertBefore($row,$anchor);
                }
                $cells=app_children($row,'tc');
                foreach($spec['fields']as$c=>$key){$v=$entries[$i][$key]??'';if(preg_match('/_(doi|doe|dob|anniv|from|to)$/',$key))$v=app_format_date($v);$cell=$cells[$c+($spec['offset']??0)];app_write_text($cell,$v);
                    if($group==='sea_service'){
                        $run=$cell->getElementsByTagNameNS(APP_WORD_NS,'r')->item(0);$pr=app_children($run,'rPr')[0]??null;
                        if(!$pr){$pr=$doc->createElementNS(APP_WORD_NS,'w:rPr');$run->insertBefore($pr,$run->firstChild);}
                        $size=app_children($pr,'sz')[0]??$doc->createElementNS(APP_WORD_NS,'w:sz');$size->setAttributeNS(APP_WORD_NS,'w:val','18');if(!$size->parentNode)$pr->appendChild($size);
                        if(in_array($key,['sea_built','sea_grt','sea_dwt','sea_bhp'],true)){
                            $tcPr=app_children($cell,'tcPr')[0];$margins=app_children($tcPr,'tcMar')[0]??$doc->createElementNS(APP_WORD_NS,'w:tcMar');
                            if(!$margins->parentNode)$tcPr->appendChild($margins);
                            foreach(['left','right']as$side){$margin=app_children($margins,$side)[0]??$doc->createElementNS(APP_WORD_NS,'w:'.$side);$margin->setAttributeNS(APP_WORD_NS,'w:w','20');$margin->setAttributeNS(APP_WORD_NS,'w:type','dxa');if(!$margin->parentNode)$margins->appendChild($margin);}
                        }
                    }
                }
            }
        }
        $body=$doc->getElementsByTagNameNS(APP_WORD_NS,'body')->item(0);$paragraphs=app_children($body,'p');
        $foundWages=false;$foundSignature=false;
        foreach($paragraphs as$i=>$p){$text=app_doc_text($p);
            if(str_contains($text,'Last Drawn Wages:')&&str_contains($text,'Expected Wages:')){
                // One underscore in the expected-wage slot is split into its own run.
                foreach($p->getElementsByTagNameNS(APP_WORD_NS,'t')as$t)if($t->textContent==='Wages: _')$t->textContent='Wages: ';
                app_fill_slots($p,[$data['last_drawn_wages'],$data['expected_wages']]);$foundWages=true;
            }
            if(str_contains($text,'RECEIVED BY')&&str_contains($text,'___________')){
                app_fill_slots($p,[app_format_date($data['signature_date']),$data['digital_signature_name']]);$foundSignature=true;
            }
            if(str_contains($text,'SIGNED BY CREW')&&isset($paragraphs[$i+1]))app_write_text($paragraphs[$i+1],'Place: '.$data['signature_place'].' | Application: '.$ref.' | Typed applicant acknowledgement');
        }
        if(!$foundWages||!$foundSignature)throw new RuntimeException('Missing wage/signature slots.');
        $updated=$doc->saveXML();if(str_contains($updated,'{{'))throw new RuntimeException('Unresolved template placeholders.');
        if(!$zip->addFromString('word/document.xml',$updated))throw new RuntimeException('Document write failed.');
    } finally {if(!$zip->close())throw new RuntimeException('Document archive could not be saved.');}
    if(!is_file($output)||filesize($output)<1000)throw new RuntimeException('Generated document is empty.');
}
