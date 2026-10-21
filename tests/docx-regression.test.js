'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const Zip=require('jszip');
const {DOMParser}=require('@xmldom/xmldom');
const schema=require('../js/application-schema.json');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'seaandseas-docx-regression-'));
const output=path.join(root,'test-output');
const wordNamespace='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
fs.mkdirSync(output,{recursive:true});
const php=path.join(temp,'generate.php');
fs.writeFileSync(php,`<?php
declare(strict_types=1);
function app_schema(): array {return json_decode(file_get_contents($GLOBALS['argv'][1].'/js/application-schema.json'),true,512,JSON_THROW_ON_ERROR);}
function app_today(): string {return (new DateTimeImmutable('now',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');}
require $argv[1].'/includes/application_validation.php';
require $argv[1].'/includes/application_docx.php';
$input=json_decode(file_get_contents($argv[2]),true,512,JSON_THROW_ON_ERROR);
[$data,$errors]=app_validate($input);
if(!$errors)app_generate_docx($data,'SS-APP-TEST-CERTIFICATES',$argv[3]);
echo json_encode(['errors'=>(object)$errors],JSON_THROW_ON_ERROR);
`);

function sample(){
 const data={};
 for(const[key,spec]of Object.entries(schema.fields)){
  data[key]='';if(!spec.required)continue;
  data[key]=spec.enum?.includes('No')?'No':spec.enum?.[0]||({date:'2020-01-01',phone:'+91 9876543210',email:'synthetic@example.test',consent:'on',ifsc:'SBIN0001234',bank_code:'SBIN0001234',account:'123456789012',number:'100',integer:'12'}[spec.type]||'Synthetic Reviewer');
 }
 for(const spec of Object.values(schema.repeats))data[spec.key]='[]';
 return data;
}
function children(node,localName){return Array.from(node.childNodes).filter(child=>child.namespaceURI===wordNamespace&&child.localName===localName);}
function cellText(node){return Array.from(node.getElementsByTagNameNS(wordNamespace,'t')).map(item=>item.textContent).join('');}
function tables(document){return Array.from(document.getElementsByTagNameNS(wordNamespace,'tbl')).map(table=>children(table,'tr').map(row=>children(row,'tc').map(cellText)));}
async function generate(name,input){
 const inputPath=path.join(temp,name+'.json');
 const outputPath=path.join(output,'docx-regression-'+name+'.docx');
 fs.writeFileSync(inputPath,JSON.stringify(input));
 const result=spawnSync('php',[php,root,inputPath,outputPath],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
 const response=JSON.parse(result.stdout);
 if(Object.keys(response.errors).length)return {errors:response.errors,outputPath};
 const zip=await Zip.loadAsync(fs.readFileSync(outputPath));
 const document=new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'),'text/xml');
 return {errors:response.errors,outputPath,zip,document,matrix:tables(document)};
}
function declaration(document){return Array.from(document.getElementsByTagNameNS(wordNamespace,'p')).map(cellText).filter(value=>value.startsWith('I declare')||value.startsWith('I hereby')||value.startsWith('I understand'));}
function declarationBlock(document){const ps=Array.from(document.getElementsByTagNameNS(wordNamespace,'p'));const s=ps.findIndex(p=>cellText(p).trim()==='DECLARATION');const e=ps.findIndex(p=>cellText(p).includes('SIGNED BY CREW'));return s>=0&&e>=s?ps.slice(s,e+1).map(cellText):[];}
let passes=0;
function check(name,fn){fn();passes++;console.log('PASS '+name);}

async function main(){
 const source=await Zip.loadAsync(fs.readFileSync(path.join(root,schema.template)));
 const original=new DOMParser().parseFromString(await source.file('word/document.xml').async('string'),'text/xml');
 const certificateSpec=schema.repeats.certificates;
 const empty=await generate('empty',sample());
 check('Blank scalar certificate groups add no fabricated rows',()=>{
  assert.deepEqual(empty.errors,{});
  assert.equal(empty.matrix[certificateSpec.table].length,tables(original)[certificateSpec.table].length);
 });
 check('Empty applicant preserves pre-printed family relationship labels in Table 1',()=>{
  const familySpec=schema.repeats.family;
  assert.equal(empty.matrix[familySpec.table][22][0],'Wife');
  assert.equal(empty.matrix[familySpec.table][23][0],'Child (M/F)');
  assert.equal(empty.matrix[familySpec.table][24][0],'Child (M/F)');
  assert.equal(empty.matrix[familySpec.table][25][0],'Child (M/F)');
 });

 const partial=await generate('partial-offshore',{...sample(),stcw_offshore_by:'Offshore Training Centre',stcw_offshore_doi:'2020-02-03',stcw_offshore_doe:'2025-02-03'});
 check('Offshore issuer and dates survive with a blank certificate number',()=>{
  assert.deepEqual(partial.errors,{});
  assert.deepEqual(partial.matrix[certificateSpec.table][certificateSpec.start],['Combined offshore (as submitted)','','03-Feb-2020','03-Feb-2025','Offshore Training Centre']);
 });
 const issuerOnly=await generate('issuer-only',{...sample(),stcw_offshore_by:'Offshore Issuer Only'});
 check('A single populated offshore field is retained without fabricating other values',()=>{
  assert.deepEqual(issuerOnly.errors,{});
  assert.deepEqual(issuerOnly.matrix[certificateSpec.table][certificateSpec.start],['Combined offshore (as submitted)','','','','Offshore Issuer Only']);
 });

 const sparse=sample();
 const fixedRows={ecdis:14,gmdss:8,hv:23};
 for(const key of Object.keys(fixedRows))Object.assign(sparse,{
  ['other_'+key+'_no']:'FOREIGN-'+key.toUpperCase(),['other_'+key+'_doi']:'2021-01-01',['other_'+key+'_by']:'Foreign Issuer',
  ['stcw_'+key+'_no']:'KEY-'+key.toUpperCase(),['stcw_'+key+'_doi']:'2022-01-01',['stcw_'+key+'_doe']:'2027-01-01',['stcw_'+key+'_by']:'Key STCW Issuer'
 });
 const separated=await generate('sparse-certificates',sparse);
 check('Sparse ECDIS, GMDSS and HV certificates retain their own dates and issuers',()=>{
  assert.deepEqual(separated.errors,{});
  for(const[key,row]of Object.entries(fixedRows))assert.deepEqual(separated.matrix[certificateSpec.table][row].slice(1),['FOREIGN-'+key.toUpperCase(),'01-Jan-2021','','Foreign Issuer']);
  schema.derivedCertificateRows.slice(0,3).forEach((record,index)=>{
   const key=record.fields[0].split('_')[1];
   assert.deepEqual(separated.matrix[certificateSpec.table][certificateSpec.start+index],[record.label,'KEY-'+key.toUpperCase(),'01-Jan-2022','01-Jan-2027','Key STCW Issuer']);
  });
 });

 const maximum={...sparse,stcw_offshore_by:'Maximum Offshore Issuer'};
 maximum.certificates_json=JSON.stringify(Array.from({length:certificateSpec.max},(_,index)=>({certificate_name:'Additional Certificate '+(index+1),certificate_no:'EXTRA-'+(index+1)})));
 const maxDocument=await generate('maximum',maximum);
 check('Twenty applicant certificates and all four scalar groups fit without loss',()=>{
  assert.deepEqual(maxDocument.errors,{});
  const rows=maxDocument.matrix[certificateSpec.table];
  assert.equal(rows.length,certificateSpec.start+certificateSpec.max+schema.derivedCertificateRows.length);
  for(let index=0;index<certificateSpec.max;index++)assert.deepEqual(rows[certificateSpec.start+index],['Additional Certificate '+(index+1),'EXTRA-'+(index+1),'','','']);
  assert.deepEqual(rows.at(-1),['Combined offshore (as submitted)','','','','Maximum Offshore Issuer']);
 });
 const excessive=await generate('too-many',{...maximum,certificates_json:JSON.stringify([...JSON.parse(maximum.certificates_json),{certificate_name:'Extra 21',certificate_no:'EXTRA-21'}])});
 check('Derived rows do not raise the twenty-record applicant limit',()=>assert.ok(excessive.errors.certificates_json));
 check('Certificate title and column labels repeat on continuation pages',()=>{
  const certificateTable=maxDocument.document.getElementsByTagNameNS(wordNamespace,'tbl').item(certificateSpec.table);
  const headerRows=children(certificateTable,'tr').slice(0,2);
  for(const row of headerRows)assert.equal(row.getElementsByTagNameNS(wordNamespace,'tblHeader').length,1);
 });

 for(const name of Object.keys(source.files).filter(name=>!source.files[name].dir&&name!=='word/document.xml'))assert.deepEqual(await maxDocument.zip.file(name).async('nodebuffer'),await source.file(name).async('nodebuffer'),name);
 check('Logos, styles, relationships and legal declaration remain unchanged',()=>{assert.deepEqual(declaration(maxDocument.document),declaration(original));assert.deepEqual(declarationBlock(maxDocument.document),declarationBlock(original));});
 console.log('\n'+passes+' DOCX regression checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}));
