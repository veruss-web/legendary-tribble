/** Formatting helpers. */
export const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);

/** Short number for tight spaces: 1.250.000 -> "1,3 jt", 4.500 -> "5 rb". Below 1.000 it is the plain rounded number. */
export const compactNumber=(n:number)=>{
 const v=Number(n)||0,abs=Math.abs(v);
 const trim=(x:number)=>x.toFixed(1).replace(/\.0$/,'').replace('.',',');
 if(abs>=1e9)return `${trim(v/1e9)} M`;
 if(abs>=1e6)return `${trim(v/1e6)} jt`;
 if(abs>=1e3)return `${Math.round(v/1e3)} rb`;
 return String(Math.round(v));
};

/** Money-field helpers: "Rp 12.500" -> "12500" (digits only, no leading zeros, capped to `max` digits) and back to "12.500" for display. */
export const digitsOnly=(raw:unknown,max=10)=>String(raw??'').replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,max);
export const groupDigits=(digits:string)=>(digits?Number(digits).toLocaleString('id-ID'):'');
