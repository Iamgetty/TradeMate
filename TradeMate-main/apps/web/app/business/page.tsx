'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE='';
const countries=[['AU','Australia','AUD'],['BR','Brazil','BRL'],['CA','Canada','CAD'],['CN','China','CNY'],['FR','France','EUR'],['DE','Germany','EUR'],['GH','Ghana','GHS'],['IN','India','INR'],['JP','Japan','JPY'],['KE','Kenya','KES'],['NG','Nigeria','NGN'],['SG','Singapore','SGD'],['ZA','South Africa','ZAR'],['AE','United Arab Emirates','AED'],['GB','United Kingdom','GBP'],['US','United States','USD']] as const;
const types=[['business','Registered business'],['sole_trader','Independent seller / sole trader'],['service_provider','Service provider']] as const;
export default function BusinessSetupPage(){
 const router=useRouter();
 const [name,setName]=useState('');
 const [type,setType]=useState('business');
 const [country,setCountry]=useState('US');
 const [currency,setCurrency]=useState('USD');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  try{
   const response=await fetch(API_BASE+'/api/organizations',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,organizationType:type,countryCode:country,defaultCurrency:currency})});
   const body=await response.json().catch(()=>({}));
   if(response.status===401){router.replace('/auth?mode=login');return}
   if(!response.ok)throw new Error(body.message||'We could not create your business space. Please try again.');
   router.push('/account?business=created');
  }catch(e){setError(e instanceof Error?e.message:'Connection issue. Please try again.')}finally{setBusy(false)}
 }
 function changeCountry(value:string){setCountry(value);const selected=countries.find(item=>item[0]===value);if(selected)setCurrency(selected[2])}
 return <main className="web3-shell account-shell"><header className="top-nav"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><Link className="nav-pill" href="/account">My space ↗</Link></header><section className="business-wrap"><div className="business-visual"><div className="business-orbit orbit-a"/><div className="business-orbit orbit-b"/><div className="business-core">T</div><span className="business-chip">YOUR BUSINESS / YOUR WORLD</span></div><div className="business-panel"><div className="section-kicker"><span/> STEP 02 / BUSINESS SETUP</div><h1>Bring your business <span>into the world.</span></h1><p className="business-intro">Create your seller space to prepare for publishing products or services to the global TradeMate marketplace.</p><form className="auth-form" onSubmit={submit}><label>Business or trading name<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={120} placeholder="The name customers will see" required/></label><label>What best describes you?<select value={type} onChange={e=>setType(e.target.value)}>{types.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Country of registration<select value={country} onChange={e=>changeCountry(e.target.value)}>{countries.map(([code,label])=><option value={code} key={code}>{label}</option>)}</select><small>Choose where your business is based. You can connect with buyers internationally.</small></label><label>Default business currency<select value={currency} onChange={e=>setCurrency(e.target.value)}>{[['AED','AED — UAE dirham'],['AUD','AUD — Australian dollar'],['BRL','BRL — Brazilian real'],['CAD','CAD — Canadian dollar'],['CNY','CNY — Chinese yuan'],['EUR','EUR — Euro'],['GBP','GBP — Pound sterling'],['GHS','GHS — Ghanaian cedi'],['INR','INR — Indian rupee'],['JPY','JPY — Japanese yen'],['KES','KES — Kenyan shilling'],['NGN','NGN — Nigerian naira'],['SGD','SGD — Singapore dollar'],['USD','USD — US dollar'],['ZAR','ZAR — South African rand']].map(([code,label])=><option value={code} key={code}>{label}</option>)}</select><small>This is your default display currency, not a payment or exchange-rate guarantee.</small></label>{error&&<div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy?'Creating your space…':'Create business space'} <span>↗</span></button></form><p className="business-footnote">Your business will start as pending while the marketplace onboarding and trust checks are developed. Creating a space does not publish a listing or enable payments.</p></div></section><footer className="footer3"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><span>TRADE SMART. TRADE DIRECT.</span><Link href="/account">BACK TO YOUR SPACE ↑</Link></footer></main>;
}
