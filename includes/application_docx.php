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
    $pPr=app_children($paragraph,'pPr')[0]??null;$pPrRPr=$pPr?(app_children($pPr,'rPr')[0]??null):null;
    $run=app_children($paragraph,'r')[0]??null;$runRPr=$run?(app_children($run,'rPr')[0]??null):null;
    $properties=($runRPr?:$pPrRPr)?->cloneNode(true);
    if(!$properties)$properties=$doc->createElementNS(APP_WORD_NS,'w:rPr');
    if($pPrRPr){
        if(!app_children($properties,'rFonts')&&($f=app_children($pPrRPr,'rFonts')[0]??null))$properties->appendChild($f->cloneNode(true));
        if(!app_children($properties,'sz')&&($s=app_children($pPrRPr,'sz')[0]??null))$properties->appendChild($s->cloneNode(true));
    }
    if($container->localName==='tc'){
        if(!app_children($properties,'rFonts')){
            $rf=$doc->createElementNS(APP_WORD_NS,'w:rFonts');$rf->setAttributeNS(APP_WORD_NS,'w:ascii','Arial Narrow');$rf->setAttributeNS(APP_WORD_NS,'w:hAnsi','Arial Narrow');$properties->appendChild($rf);
        }
        if(!app_children($properties,'sz')){
            $sz=$doc->createElementNS(APP_WORD_NS,'w:sz');$sz->setAttributeNS(APP_WORD_NS,'w:val','18');$properties->appendChild($sz);
        }
    }
    foreach(iterator_to_array($paragraph->childNodes)as$child)if($child->localName!=='pPr')$paragraph->removeChild($child);
    if($container->localName==='tc')foreach(array_slice(app_children($container,'p'),1)as$p)$container->removeChild($p);
    $r=$doc->createElementNS(APP_WORD_NS,'w:r');if($properties)$r->appendChild($properties);
    $t=$doc->createElementNS(APP_WORD_NS,'w:t');$t->setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');$t->appendChild($doc->createTextNode($text));$r->appendChild($t);$paragraph->appendChild($r);
    // Preserve template exact row heights and flow to keep document pagination compact.
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
        // This table has one consistent column layout, including appended certificates.
        // Repeat its title and column labels when additional rows span another page.
        foreach(array_slice(app_children($tables[6],'tr'),0,2)as$header){
            $pr=app_children($header,'trPr')[0]??$doc->createElementNS(APP_WORD_NS,'w:trPr');
            if(!$pr->parentNode)$header->insertBefore($pr,$header->firstChild);
            if(!app_children($pr,'tblHeader'))$pr->appendChild($doc->createElementNS(APP_WORD_NS,'w:tblHeader'));
        }
        // The supplied U.S. visa cells are vertical-merge continuations, which Word hides.
        // Split only these four data/header cells so the mapped values are visible.
        foreach([3,4]as$r)for($c=0;$c<4;$c++)foreach(iterator_to_array($matrix[3][$r][$c]->getElementsByTagNameNS(APP_WORD_NS,'vMerge'))as$merge)$merge->parentNode->removeChild($merge);
        foreach([1=>'Date of Issue',2=>'Place of Issue',3=>'Date of Expiry']as$c=>$label)app_write_text($matrix[3][3][$c],$label);
        $body=$doc->getElementsByTagNameNS(APP_WORD_NS,'body')->item(0);
        // Page 1: Remove empty spacer paragraphs before Table 0 and align applicant photo box
        $photoP=null;
        for($c=$body->firstChild;$c&&$c!==$tables[0];$c=$next){
            $next=$c->nextSibling;
            if($c->nodeType===XML_ELEMENT_NODE&&$c->localName==='p'){
                $hasDraw=$c->getElementsByTagNameNS(APP_WORD_NS,'drawing')->length>0||$c->getElementsByTagNameNS('urn:schemas-microsoft-com:vml','rect')->length>0;
                if($hasDraw)$photoP=$c;
                else if(trim($c->textContent)==='')$body->removeChild($c);
            }
        }
        if($photoP){
            foreach($photoP->getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing','positionV')as$pv){
                foreach(app_children($pv,'posOffset')as$po)$po->textContent='0';
            }
            foreach($photoP->getElementsByTagNameNS('urn:schemas-microsoft-com:vml','rect')as$rect){
                $s=$rect->getAttribute('style');
                $rect->setAttribute('style',preg_replace('/margin-top:[^;]+;/','margin-top:0pt;',$s));
            }
            foreach($photoP->getElementsByTagNameNS(APP_WORD_NS,'r')as$r){
                foreach(app_children($r,'tab')as$tb)$tb->parentNode->removeChild($tb);
            }
            $pPr=app_children($photoP,'pPr')[0]??null;
            if($pPr){
                $sp=app_children($pPr,'spacing')[0]??$doc->createElementNS(APP_WORD_NS,'w:spacing');
                $sp->setAttributeNS(APP_WORD_NS,'w:before','0');$sp->setAttributeNS(APP_WORD_NS,'w:after','0');
                $sp->setAttributeNS(APP_WORD_NS,'w:line','100');$sp->setAttributeNS(APP_WORD_NS,'w:lineRule','exact');
                if(!$sp->parentNode)$pPr->appendChild($sp);
            }
        }
        $between01=[];
        for($c=$tables[0]->nextSibling;$c&&$c!==$tables[1];$c=$c->nextSibling){
            if($c->nodeType===XML_ELEMENT_NODE&&$c->localName==='p'&&trim($c->textContent)==='')$between01[]=$c;
        }
        foreach(array_slice($between01,1)as$p)$body->removeChild($p);
        // Page 1: Tables 0 & 1. Place a clean page break between Table 1 and Table 2.
        for($n=$tables[1]->nextSibling;$n&&$n!==$tables[2];$n=$next){$next=$n->nextSibling;$body->removeChild($n);}
        $pbP1=$doc->createElementNS(APP_WORD_NS,'w:p');$pbR1=$doc->createElementNS(APP_WORD_NS,'w:r');$pbBr1=$doc->createElementNS(APP_WORD_NS,'w:br');
        $pbBr1->setAttributeNS(APP_WORD_NS,'w:type','page');$pbR1->appendChild($pbBr1);$pbP1->appendChild($pbR1);$body->insertBefore($pbP1,$tables[2]);
        // Page 2: Tables 2, 3, 4. Place a clean page break between Table 4 and Table 5.
        for($n=$tables[4]->nextSibling;$n&&$n!==$tables[5];$n=$next){$next=$n->nextSibling;$body->removeChild($n);}
        $pbP2=$doc->createElementNS(APP_WORD_NS,'w:p');$pbR2=$doc->createElementNS(APP_WORD_NS,'w:r');$pbBr2=$doc->createElementNS(APP_WORD_NS,'w:br');
        $pbBr2->setAttributeNS(APP_WORD_NS,'w:type','page');$pbR2->appendChild($pbBr2);$pbP2->appendChild($pbR2);$body->insertBefore($pbP2,$tables[5]);
        // Pages 3 & 4: Table 5. Clean up spacer paragraphs between Table 5 and Table 6 and place page break so Table 6 starts directly on Page 5.
        for($n=$tables[5]->nextSibling;$n&&$n!==$tables[6];$n=$next){$next=$n->nextSibling;$body->removeChild($n);}
        $pbP5=$doc->createElementNS(APP_WORD_NS,'w:p');$pbR5=$doc->createElementNS(APP_WORD_NS,'w:r');$pbBr5=$doc->createElementNS(APP_WORD_NS,'w:br');
        $pbBr5->setAttributeNS(APP_WORD_NS,'w:type','page');$pbR5->appendChild($pbBr5);$pbP5->appendChild($pbR5);$body->insertBefore($pbP5,$tables[6]);
        // The original floating landscape table starts under the header logo.
        // Preserve clean flow: unfloat Table 7, remove redundant page breaks, and tighten margins.
        foreach(iterator_to_array($tables[7]->getElementsByTagNameNS(APP_WORD_NS,'tblpPr'))as$p)$p->parentNode->removeChild($p);
        for($node=$tables[7]->previousSibling;$node;$node=$node->previousSibling){
            if($node->localName==='p'){
                foreach(iterator_to_array($node->getElementsByTagNameNS(APP_WORD_NS,'br'))as$br)if($br->getAttributeNS(APP_WORD_NS,'type')==='page')$br->parentNode->removeChild($br);
                break;
            }
        }
        foreach($doc->getElementsByTagNameNS(APP_WORD_NS,'sectPr')as$i=>$section){
            $size=app_children($section,'pgSz')[0]??null;
            if($size?->getAttributeNS(APP_WORD_NS,'orient')==='landscape'){
                $margin=app_children($section,'pgMar')[0];$margin->setAttributeNS(APP_WORD_NS,'w:top','720');$margin->setAttributeNS(APP_WORD_NS,'w:bottom','480');
            } else if($i===0){
                $margin=app_children($section,'pgMar')[0];$margin->setAttributeNS(APP_WORD_NS,'w:top','360');$margin->setAttributeNS(APP_WORD_NS,'w:bottom','360');$margin->setAttributeNS(APP_WORD_NS,'w:header','360');$margin->setAttributeNS(APP_WORD_NS,'w:footer','200');
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
            if(count($entries)>$spec['max'])throw new RuntimeException('Too many repeated records.');
            if($group==='certificates')foreach($schema['derivedCertificateRows']as$record){
                $recordValues=array_map(fn($key)=>$data[$key]??'', $record['fields']);
                if(count(array_filter($recordValues,fn($value)=>$value!==''))===0)continue;
                // Each certificate keeps its own blank cells so sparse dates retain their association.
                $entries[]=array_combine($spec['fields'],[$record['label'],...$recordValues]);
            }
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
                foreach($spec['fields']as$c=>$key){$v=$entries[$i][$key]??'';if(preg_match('/_(doi|doe|dob|anniv|from|to)$/',$key))$v=app_format_date($v);if($group==='family'&&$c===0&&$v===''&&$i<$spec['capacity'])continue;$cell=$cells[$c+($spec['offset']??0)];app_write_text($cell,$v);
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
        // Compact Table 5 across Pages 3 and 4 with 7.5pt text and tight padding
        foreach(app_children($tables[5],'tr')as$row){
            $trPr=app_children($row,'trPr')[0]??$doc->createElementNS(APP_WORD_NS,'w:trPr');
            if(!$trPr->parentNode)$row->insertBefore($trPr,$row->firstChild);
            $trH=app_children($trPr,'trHeight')[0]??$doc->createElementNS(APP_WORD_NS,'w:trHeight');
            $trH->setAttributeNS(APP_WORD_NS,'w:val','210');$trH->setAttributeNS(APP_WORD_NS,'w:hRule','atLeast');
            if(!$trH->parentNode)$trPr->appendChild($trH);
            foreach(app_children($row,'tc')as$tc){
                $tcPr=app_children($tc,'tcPr')[0]??$doc->createElementNS(APP_WORD_NS,'w:tcPr');
                if(!$tcPr->parentNode)$tc->insertBefore($tcPr,$tc->firstChild);
                $tcMar=app_children($tcPr,'tcMar')[0]??$doc->createElementNS(APP_WORD_NS,'w:tcMar');
                if(!$tcMar->parentNode)$tcPr->appendChild($tcMar);
                foreach(['left'=>40,'right'=>40,'top'=>10,'bottom'=>10]as$side=>$val){
                    $m=app_children($tcMar,$side)[0]??$doc->createElementNS(APP_WORD_NS,'w:'.$side);
                    $m->setAttributeNS(APP_WORD_NS,'w:w',(string)$val);$m->setAttributeNS(APP_WORD_NS,'w:type','dxa');
                    if(!$m->parentNode)$tcMar->appendChild($m);
                }
                foreach(app_children($tc,'p')as$p){
                    $pPr=app_children($p,'pPr')[0]??$doc->createElementNS(APP_WORD_NS,'w:pPr');
                    if(!$pPr->parentNode)$p->insertBefore($pPr,$p->firstChild);
                    $sp=app_children($pPr,'spacing')[0]??$doc->createElementNS(APP_WORD_NS,'w:spacing');
                    $sp->setAttributeNS(APP_WORD_NS,'w:after','0');$sp->setAttributeNS(APP_WORD_NS,'w:before','0');$sp->setAttributeNS(APP_WORD_NS,'w:line','200');$sp->setAttributeNS(APP_WORD_NS,'w:lineRule','auto');
                    if(!$sp->parentNode)$pPr->appendChild($sp);
                    $rPr=app_children($pPr,'rPr')[0]??null;
                    if($rPr){
                        $sz=app_children($rPr,'sz')[0]??null;if($sz)$sz->setAttributeNS(APP_WORD_NS,'w:val','15');
                        $szCs=app_children($rPr,'szCs')[0]??null;if($szCs)$szCs->setAttributeNS(APP_WORD_NS,'w:val','15');
                    }
                    foreach(app_children($p,'r')as$r){
                        $runRPr=app_children($r,'rPr')[0]??$doc->createElementNS(APP_WORD_NS,'w:rPr');
                        if(!$runRPr->parentNode)$r->insertBefore($runRPr,$r->firstChild);
                        $sz=app_children($runRPr,'sz')[0]??$doc->createElementNS(APP_WORD_NS,'w:sz');
                        $sz->setAttributeNS(APP_WORD_NS,'w:val','15');
                        if(!$sz->parentNode)$runRPr->appendChild($sz);
                        $szCs=app_children($runRPr,'szCs')[0]??null;if($szCs)$szCs->setAttributeNS(APP_WORD_NS,'w:val','15');
                    }
                }
            }
        }
        // Compact Table 6 onto Page 5 with 9pt labels and tight row heights
        foreach(app_children($tables[6],'tr')as$row){
            $trPr=app_children($row,'trPr')[0]??$doc->createElementNS(APP_WORD_NS,'w:trPr');
            if(!$trPr->parentNode)$row->insertBefore($trPr,$row->firstChild);
            $trH=app_children($trPr,'trHeight')[0]??$doc->createElementNS(APP_WORD_NS,'w:trHeight');
            $trH->setAttributeNS(APP_WORD_NS,'w:val','265');$trH->setAttributeNS(APP_WORD_NS,'w:hRule','atLeast');
            if(!$trH->parentNode)$trPr->appendChild($trH);
            foreach(app_children($row,'tc')as$tc){
                foreach(app_children($tc,'p')as$p){
                    $pPr=app_children($p,'pPr')[0]??null;
                    $rPr=$pPr?app_children($pPr,'rPr')[0]??null:null;
                    if($rPr){
                        $sz=app_children($rPr,'sz')[0]??null;
                        if($sz&&(int)$sz->getAttributeNS(APP_WORD_NS,'val')>18)$sz->setAttributeNS(APP_WORD_NS,'w:val','18');
                    }
                    foreach(app_children($p,'r')as$r){
                        $runRPr=app_children($r,'rPr')[0]??null;
                        if($runRPr){
                            $sz=app_children($runRPr,'sz')[0]??null;
                            if($sz&&(int)$sz->getAttributeNS(APP_WORD_NS,'val')>18)$sz->setAttributeNS(APP_WORD_NS,'w:val','18');
                        }
                    }
                }
            }
        }
        // Clean up empty spacer paragraphs between Declaration and Signatures so they fit together on Page 8
        $declFound=false;$sigFound=false;$emptyPs=[];
        foreach(iterator_to_array($body->childNodes)as$child){
            if($child->localName==='tbl'&&$child===$tables[11]){$declFound=false;}
            $text=app_doc_text($child);
            if(str_contains($text,'DECLARATION')){$declFound=true;}
            elseif(str_contains($text,'RECEIVED BY')){$sigFound=true;}
            elseif($declFound&&!$sigFound&&$child->localName==='p'&&trim($text)===''){$emptyPs[]=$child;}
            elseif($sigFound&&$child->localName==='p'&&trim($text)===''){$emptyPs[]=$child;}
        }
        foreach(array_slice($emptyPs,1)as$p)$body->removeChild($p);
        $updated=$doc->saveXML();if(str_contains($updated,'{{'))throw new RuntimeException('Unresolved template placeholders.');
        if(!$zip->addFromString('word/document.xml',$updated))throw new RuntimeException('Document write failed.');
    } finally {if(!$zip->close())throw new RuntimeException('Document archive could not be saved.');}
    if(!is_file($output)||filesize($output)<1000)throw new RuntimeException('Generated document is empty.');
}
