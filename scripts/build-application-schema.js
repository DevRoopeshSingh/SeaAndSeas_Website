const fs = require('fs');
const crypto = require('crypto');
const html = fs.readFileSync('apply.html', 'utf8');
const fields = {};
function add(name,t,r,c,prefix='',extra={}) {
  const source=[...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].find(m=>m[0].includes('name="'+name+'"'))?.[0]||'';
  fields[name]={label:name.replaceAll('_',' '),step:1,type:source.includes('type="date"')?'date':'text',max:120,required:/\brequired\b/.test(source),db:'data.'+name,...(t===null?{}:{cell:[t,r,c],prefix}),...extra};
}
add('position_applied',0,1,1);add('accept_lower_rank',0,2,1,'',{enum:['YES','NO'],required:true});add('date_availability',0,3,0,'Date of Availability: ',{type:'date'});
const personal={full_name:[2,1],dob:[3,0,'Date of Birth: '],pob:[3,1,'Place of Birth: '],nationality:[3,3],permanent_address:[4,1],permanent_postcode:[6,2],permanent_phone:[6,4],email:[7,1],phone:[7,3],present_address:[8,1],present_postcode:[10,2],present_phone:[10,4],nearest_airport:[11,1],marital_status:[12,1],height_cm:[13,1],weight_kg:[13,5],boiler_suit_size:[14,0,'Boiler Suit Size : '],shoe_size:[14,1,'Shoe Size : '],kin_name:[16,1],kin_relationship:[16,3],kin_address:[17,1],kin_postcode:[18,3],kin_phone_primary:[19,2],kin_phone_secondary:[19,4]};
for(const [k,v] of Object.entries(personal))add(k,1,...v);
for(const k of ['permanent_address','present_address','kin_address'])fields[k].max=350;
fields.email.type='email';
for(const k of ['phone','permanent_phone','present_phone','kin_phone_primary','kin_phone_secondary'])fields[k].type='phone';
Object.assign(fields.height_cm,{type:'number',min:80,maxNumber:250});Object.assign(fields.weight_kg,{type:'number',min:20,maxNumber:300});
for(const [k,r,c] of [['medical_signoff',1,1],['medical_unfit_disease',6,1],['medical_addiction',7,1],['medical_psychiatric',11,1],...['malaria','diabetes','epilepsy','nervous','hepatitis'].map((k,i)=>['med_'+k,10,i])]){
 add(k,2,r,c,'',{step:2,enum:['Yes','No'],required:true});
 if(k!=='medical_signoff')add(k+'_details',2,r,c,'',{step:2,max:180,when:[k,'Yes'],append:true,label:'Explanation for '+k.replaceAll('_',' ')});
}
add('med_vessel_name',2,2,0,'Name of the Vessel: ',{step:2,when:['medical_signoff','Yes']});add('med_occurrence_date',2,2,1,'Date of Occurrence: ',{step:2,type:'date',when:['medical_signoff','Yes']});add('med_description',2,5,0,'Brief description of Illness / Injury / Accident: ',{step:2,max:250,when:['medical_signoff','Yes']});
for(const [k,c] of [['no',0],['doi',1],['poi',2],['doe',3],['ecnr',4],['blank_pages',5]])add('passport_'+k,3,2,c,'',{step:3});
fields.passport_ecnr.enum=['YES','NO'];Object.assign(fields.passport_blank_pages,{type:'integer',min:1,maxNumber:60});
for(const [k,c] of [['type',0],['doi',1],['poi',2],['doe',3]])add('us_visa_'+k,3,4,c,'',{step:3,type:['doi','doe'].includes(k)?'date':'text'});
add('us_visa_no',3,4,0,'',{step:3,append:true});add('mui_membership_no',3,4,4,'',{step:3});add('mui_doe',3,4,5,'',{step:3,type:'date'});add('other_visa_details',3,6,5,'',{step:3,max:250});
for(const [p,r] of [['presea',8],['cadet',11],['cadet_2',12],['cadet_3',13]])for(const [k,c] of [['institute',0],['from',1],['to',2],['grade',3],['degree',4]])add(p+'_'+k,4,r,c,'',{step:3,type:['from','to'].includes(k)?'date':'text'});
const groups={cdc:['indian','honduras','cook','liberian','panama','bahamas','belize','vanuatu','palau','other'],coc:['indian','honduras','uk','panama','cook','other'],cert:['otfc','ctfc','lgtc','tasco','chemco','gasco'],dce:['oil','chem','gas'],stcw:['pssr','pst','fpff','efa','stsdsd','ref_pssr','ref_pst','ref_fpff','ref_efa','ref_stsdsd','pscrb','pssr_amend','aff','mfa','watchkeeping','ab_deck','ab_eng','cook','welder','fitter','eto','yf','bosiet','opito','h2s','huet','other'],other:['basic','stsdsd','pscrb','frb','aff','mfa','gmdss','sso','lrtm','mea','arpa','radar','ecdis','isps','brm','btm','ers','erm','lchs','medcare','sat','hv','nav_watch','eng_watch','ab_deck','ab_eng']};
for(const [g,keys]of Object.entries(groups))keys.forEach((key,i)=>{
 const six=['coc','dce'].includes(g);const suffix=six?[g==='coc'?'rank':'level','no','doi','doe',g==='coc'?'poi':'by']:['no','doi','doe',g==='cdc'?'poi':'by'];
 suffix.forEach((s,c)=>add(g+'_'+key+'_'+s,g==='other'?6:5,({cdc:3,coc:17,cert:25,dce:33,stcw:38,other:2})[g]+i,c+1,'',{step:4,type:['doi','doe'].includes(s)?'date':'text'}));
});
for(const[key,row]of[['ecdis',14],['gmdss',8],['hv',23]])for(const[s,c]of[['no',1],['doi',2],['doe',3],['by',4]])add('stcw_'+key+'_'+s,6,row,c,'',{step:4,type:['doi','doe'].includes(s)?'date':'text',append:true});
for(const s of['no','doi','doe','by'])add('stcw_offshore_'+s,null,0,0,'',{step:4,type:['doi','doe'].includes(s)?'date':'text',special:'Legacy combined offshore certificate row in table 6'});
add('indos_number',5,14,1,'',{step:4});add('indos_issued_by',5,14,2,'Issued by: ',{step:4});
for(const[i,k]of['deck_bulk_cargo','deck_product_cargo','deck_chemical_cargo','deck_tanker_pumps'].entries())add(k,8,2+i,1,'',{step:6});
for(const[i,k]of['eng_automation_type','eng_cranes_type','eng_grabs_type'].entries())add(k,8,7+i,1,'',{step:6});
for(const[i,k]of['eto_automation_type','eto_nor_system','eto_hydraulics_type','eto_plc_type'].entries())add(k,8,11+i,1,'',{step:6});
for(const[k,r,c]of[['trading_areas',16,0],['cdi_details',18,1],['cdi_inspection',18,2],['psc_inspections',19,1],['oil_major_inspections',20,1],['drydock_experience',22,0]])add(k,8,r,c,'',{step:6});
fields.cdi_inspection.enum=['Yes','No'];
for(let i=1;i<=3;i++)for(const[k,c]of[['vessel',0],['nature',1]])add('drydock_'+k+'_'+i,8,21+i,c,'',{step:6,append:i===1&&c===0});
for(const[k,r]of[['post_salary',2],['account_type',3],['holder_name',4],['name',5],['account_no',6],['address',7],['ifsc',8],['date_joining',9]])add('bank_'+k,10,r,2,'',{step:7});
for(const[k,r]of[['account_type',2],['holder_name',3],['bank_name',4],['account_no',5],['bank_address',6],['ifsc_swift',7]])add('nri_'+k,11,r,2,'',{step:7});
for(const k of['last_drawn_wages','expected_wages','signature_place','signature_date','digital_signature_name'])add(k,null,0,0,'',{step:7,special:k.includes('wages')?'Wages paragraph':'Applicant signature/date paragraph'});
for(const k of['declaration_truth','declaration_social_media','declaration_zero_fee'])add(k,null,0,0,'',{step:7,type:'consent',required:true,special:'Consent stored in database; original declaration paragraphs preserved'});
const repeats={licences:{key:'licences_json',step:4,max:12,table:5,start:23,capacity:0,required:['licence_flag','licence_rank','licence_no'],fields:['licence_flag','licence_rank','licence_no','licence_doi','licence_doe','licence_poi']},family:{key:'family_json',step:2,max:12,table:1,start:22,capacity:4,fields:['fam_rel','fam_name','fam_anniv','fam_dob','fam_ppt','fam_doi','fam_poi','fam_doe','fam_ecnr']},education:{key:'education_json',step:3,max:12,table:4,start:3,capacity:3,fields:['edu_school','edu_from','edu_to','edu_degree']},visas:{key:'visas_json',step:3,max:10,table:3,start:6,capacity:2,fields:['visa_name','visa_doi','visa_poi','visa_doe']},sea_service:{key:'sea_service_json',step:5,max:10,table:7,start:3,capacity:10,offset:1,fields:['sea_owner','sea_vessel','sea_built','sea_type','sea_grt','sea_dwt','sea_engine','sea_bhp','sea_rank','sea_from','sea_to','sea_total','sea_reason']},certificates:{key:'certificates_json',step:4,max:20,table:6,start:28,capacity:0,fields:['certificate_name','certificate_no','certificate_doi','certificate_doe','certificate_by']}};
for(const[k,v]of Object.entries(fields)){
 const match=html.match(new RegExp('<[^>]*name="'+k+'"[^>]*>'));
 if(match){const steps=[...html.slice(0,match.index).matchAll(/data-step="(\d+)"/g)];if(steps.length)v.step=Number(steps.at(-1)[1]);if(match[0].includes('type="date"'))v.type='date';}
 const select=html.match(new RegExp('<select[^>]*name="'+k+'"[^>]*>([\\s\\S]*?)</select>'));
 if(select)v.enum=[...select[1].matchAll(/<option[^>]*value="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
 if(k.includes('account_no')){v.type='account';v.max=34;}
}
fields.nri_ifsc_swift.type='bank_code';fields.bank_ifsc.type='ifsc';fields.signature_date.type='date';fields.dob.type='date';
const schema={version:1,template:'NEW-APPLICATION-FORMAT-1.docx',sha256:crypto.createHash('sha256').update(fs.readFileSync('NEW-APPLICATION-FORMAT-1.docx')).digest('hex'),fields,repeats};
fs.writeFileSync('js/application-schema.json',JSON.stringify(schema,null,2)+'\n');
let doc='# Application field mapping\n\nAll coordinates are zero-based physical OOXML cells. Template SHA-256: '+schema.sha256+'. Every field is stored in applications.data_json; full name, position, email, phone and INDOS additionally have indexed columns. Generated by scripts/build-application-schema.js.\n\n| Online field | Database path | DOCX destination |\n|---|---|---|\n';
for(const[k,v]of Object.entries(fields))doc+='| '+k+' | '+v.db+' | '+(v.cell?'Table '+v.cell[0]+', row '+v.cell[1]+', cell '+v.cell[2]+(v.append?' (combined value)':''):v.special)+' |\n';
for(const[group,v]of Object.entries(repeats)){doc+='\n## '+group+'\n\nMaximum '+v.max+' entries. Fill '+v.capacity+' original rows; clone existing row formatting for overflow.\n\n| Online subfield | Database path | DOCX destination |\n|---|---|---|\n';v.fields.forEach((k,c)=>doc+='| '+k+'_n | data.'+v.key+'[n].'+k+' | Table '+v.table+', row '+v.start+' + n, cell '+(c+(v.offset||0))+' |\n');}
doc+='\n## Preserved office fields\n\nTable 9 interviewer, technical, safety, pollution prevention and operation fields stay blank for authorized staff to complete after download. Company receiving/signature paragraphs stay unchanged and unsigned. Applicant date, typed acknowledgement and place fill the adjacent signature line. Original legal declaration wording is preserved verbatim. CV, application number, statuses, timestamps and audits have dedicated private database fields; reference is also inserted beside the applicant acknowledgement. No applicant-supplied office information is accepted.\n';
fs.writeFileSync('docs/application-field-mapping.md',doc);
console.log(Object.keys(fields).length+' scalar fields and '+Object.keys(repeats).length+' repeat groups mapped');
