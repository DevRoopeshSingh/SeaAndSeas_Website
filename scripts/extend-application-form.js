const fs=require('fs');
let html=fs.readFileSync('apply.html','utf8');
const schema=JSON.parse(fs.readFileSync('js/application-schema.json','utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(let step=7;step>=1;step--){
 const absent=Object.entries(schema.fields).filter(([k,v])=>v.step===step&&!html.includes('name="'+k+'"'));
 let content='\n            <!-- Additional template fields: generated from the inspected cell map -->\n';
 const courses={};const ordinary=[];
 for(const[k,v]of absent){if(/^(stcw|other)_.+_(no|doi|doe|by)$/.test(k)){const p=k.replace(/_(no|doi|doe|by)$/,'');courses[p]=true;}else ordinary.push([k,v]);}
 if(ordinary.length){content+='<div class="form-section-title">Additional '+({2:'Medical Details',3:'Travel and Training Records',6:'Inspection and Dry Docking Records',7:'Account Details'}[step]||'Application Details')+'</div><div class="form-grid-3">';
 for(const[k,v]of ordinary){content+='<div class="form-group"'+(v.when?' data-condition="'+v.when[0]+'"':'')+'><label for="extra_'+k+'">'+esc(v.label)+'</label><input id="extra_'+k+'" class="form-input" name="'+k+'" type="'+(v.type==='date'?'date':'text')+'" maxlength="'+v.max+'"></div>';}
 content+='</div>';}
 if(Object.keys(courses).length){content+='<div class="form-section-title">Remaining Indian and Other Flag Courses and Certificates</div><p class="hint">Leave courses you have not completed blank. Existing certificate entries above are retained.</p><div class="table-responsive"><table class="data-entry-table"><thead><tr><th>Course</th><th>Certificate Number</th><th>Issue Date</th><th>Expiry Date</th><th>Issued By</th></tr></thead><tbody>';
 for(const p of Object.keys(courses)){content+='<tr><td>'+esc(p.replace(/^stcw_/,'Indian: ').replace(/^other_/,'Other flag: ').replaceAll('_',' ').toUpperCase())+'</td>';for(const s of['no','doi','doe','by'])content+='<td><input name="'+p+'_'+s+'" type="'+(['doi','doe'].includes(s)?'date':'text')+'" aria-label="'+p+' '+s+'" maxlength="120"></td>';content+='</tr>';}
 content+='</tbody></table></div>';}
 for(const [group,v]of Object.entries(schema.repeats))if(v.step===step&&!['family','education','sea_service'].includes(group)){
 content+='<div class="form-section-title">'+({visas:'Additional Visas',licences:'Additional Licences',certificates:'Additional Named Certificates and Courses'}[group])+'</div><p class="hint">Include the course/category or licence rank in the name. Maximum '+v.max+' records.</p><div class="table-responsive"><table class="data-entry-table"><thead><tr>'+v.fields.map(k=>'<th>'+esc(k.replaceAll('_',' ').replace('doi','issue date').replace('doe','expiry date'))+'</th>').join('')+'<th>Remove</th></tr></thead><tbody id="'+group+'TableBody" data-repeat="'+group+'"></tbody></table></div><button type="button" class="btn-add-row" data-add-repeat="'+group+'">+ Add '+group+' record</button>';
 }
 if(step===7){content+='<p class="hint">Your typed name acknowledges this application. Company receiving and interview fields are completed by staff.</p>';}
 const start=html.indexOf('<div class="step-content" data-step="'+step+'"');
 let next=html.indexOf('<div class="step-content" data-step="'+(step+1)+'"',start+1);
 if(next<0)next=html.indexOf('<!-- =================================================================\n               WIZARD CONTROLS',start);
 const end=html.lastIndexOf('</div>',next);
 html=html.slice(0,end)+content+'\n          '+html.slice(end);
}
fs.writeFileSync('apply.html',html);
