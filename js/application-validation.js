/* Shared field rules; PHP independently enforces the same schema on submission. */
(function(root){
  function date(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>='1900-01-01'&&v<='2200-12-31';}
  function error(value,spec){
    const v=String(value||'').trim();
    if(!v)return spec.required?'This field is required.':'';
    if([...v].length>spec.max)return 'Use no more than '+spec.max+' characters.';
    if(spec.enum&&!spec.enum.includes(v))return 'Choose a listed answer.';
    let valid=true;
    switch(spec.type){
      case 'date':valid=date(v);break;
      case 'email':valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);break;
      case 'phone':valid=/^\+?[0-9 ()-]{7,25}$/.test(v)&&v.replace(/\D/g,'').length>=7&&v.replace(/\D/g,'').length<=15;break;
      case 'number':case 'integer':valid=Number.isFinite(Number(v))&&(spec.type!=='integer'||/^\d+$/.test(v))&&(!('min'in spec)||Number(v)>=spec.min)&&(!('maxNumber'in spec)||Number(v)<=spec.maxNumber);break;
      case 'ifsc':valid=/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);break;
      case 'bank_code':valid=/^(?:[A-Z]{4}0[A-Z0-9]{6}|[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)$/.test(v);break;
      case 'account':valid=/^[A-Z0-9 -]{5,34}$/i.test(v);break;
      case 'consent':valid=['on','true','1'].includes(v);break;
    }
    return valid?'':'Enter a valid '+spec.label+'.';
  }
  function validate(data,schema,step){
    const errors={};const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
    for(const[k,s]of Object.entries(schema.fields)){
      if(step&&s.step!==step)continue;
      const message=error(data[k],{...s,required:s.required||(s.when&&data[s.when[0]]===s.when[1])});if(message)errors[k]=message;
      const to=k.endsWith('_doi')?k.slice(0,-4)+'_doe':k.endsWith('_from')?k.slice(0,-5)+'_to':null;
      if(to&&data[k]&&data[to]&&data[k]>data[to])errors[to]='End/expiry must be after start/issue.';
    }
    if((!step||step===1)&&data.dob>=today)errors.dob='Birth date must be in the past.';
    if(!step||step===7){if(data.signature_date>today)errors.signature_date='Signature date cannot be in the future.';if((data.digital_signature_name||'').trim().toLowerCase()!==(data.full_name||'').trim().toLowerCase())errors.digital_signature_name='Type the same full name as your personal details.';}
    for(const[group,s]of Object.entries(schema.repeats)){
      if(step&&s.step!==step)continue;
      let entries;try{entries=typeof data[s.key]==='string'?JSON.parse(data[s.key]):data[s.key]||[];}catch{entries=null;}
      if(!Array.isArray(entries)||entries.length>s.max){errors[s.key]='Enter up to '+s.max+' valid records.';continue;}
      entries.forEach((row,i)=>{
        const required=s.required||{family:['fam_rel','fam_name'],education:['edu_school','edu_degree'],visas:['visa_name'],certificates:['certificate_name','certificate_no'],sea_service:['sea_owner','sea_vessel','sea_rank','sea_from','sea_to']}[group];
        for(const k of s.fields){const type=/_(doi|doe|dob|anniv|from|to)$/.test(k)?'date':/^sea_(built|grt|dwt|bhp)$/.test(k)?'integer':'text';const message=error(row[k],{label:k.replaceAll('_',' '),type,max:120,required:required.includes(k),min:k==='sea_built'?1800:0,maxNumber:k==='sea_built'?new Date().getFullYear():10000000});if(message)errors[s.key+'.'+i+'.'+k]=message;}
        for(const[a,b]of[['fam_doi','fam_doe'],['edu_from','edu_to'],['visa_doi','visa_doe'],['certificate_doi','certificate_doe'],['licence_doi','licence_doe'],['sea_from','sea_to']])if(row[a]&&row[b]&&row[a]>row[b])errors[s.key+'.'+i+'.'+b]='End/expiry must be after start/issue.';
        if(row.fam_dob&&row.fam_dob>=today)errors[s.key+'.'+i+'.fam_dob']='Birth date must be in the past.';
        if(row.sea_to&&row.sea_to>today)errors[s.key+'.'+i+'.sea_to']='Sign-off date cannot be in the future.';
      });
    }
    if(!step||step===3)if(data.us_visa_type&&data.us_visa_type!=='None')for(const k of['us_visa_no','us_visa_poi','us_visa_doi','us_visa_doe'])if(!data[k])errors[k]='Complete U.S. visa details.';
    if(!step||step===7)if(data.nri_account_no)for(const k of['nri_account_type','nri_holder_name','nri_bank_name','nri_ifsc_swift'])if(!data[k])errors[k]='Complete NRI account details.';
    return errors;
  }
  root.ApplicationValidation={error,validate};
  if(typeof module!=='undefined')module.exports=root.ApplicationValidation;
})(typeof window==='undefined'?globalThis:window);
