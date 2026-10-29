'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
type User={id:string;email:string;display_name:string;country_code:string|null};
type Organization={id:string;name:string;organization_type:string;country_code:string;default_currency:string;status:string;member_role:string};
const API_BASE='';
export default function AccountPage(){
 const router=useRouter();
 const [user,setUser]=useState<User|null>(null);
 const [organization,setOrganization]=useState<Organization|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   try{
    const r=await fetch(API_BASE+'/api/auth/me',{credentials:'include',cache:'no-store'});
    if(!r.ok){router.replace('/auth?mode=login');return}
    const d=await r.json();
    if(cancelled)return;
    setUser(d.user);
    const orgResponse=await fetch(API_BASE+'/api/organizations/mine',{credentials:'include',cache:'no-store'});
    if(orgResponse.ok){
     const orgData=await orgResponse.json();
     if(!cancelled)setOrganization(orgData.organization||null);
    }
   }catch{
    if(!cancelled)setError('Could not connect to TradeMate. Check your connection and try again.');
   }finally{if(!cancelled)setLoading(false)}
  })();
  return()=>{cancelled=true};
 },[router]);
 async function logout(){await fetch(API_BASE+'/api/auth/logout',{method:'POST',credentials:'include'}).catch(()=>undefined);router.replace('/');}
 return <main className="web3-shell account-shell">
  <header className="top-nav"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><button className="nav-pill account-logout" onClick={logout}>Sign out ↗</button></header>
  <section className="account-wrap">
   {loading?<div className="market-state"><div className="empty-orb3"><span>◈</span></div><h3>Opening your space…</h3><p>Checking your secure session.</p></div>
   :error?<div className="market-state"><div className="state-orb">!</div><h3>Connection interrupted</h3><p>{error}</p><button className="retry-btn" onClick={()=>location.reload()}>Try again ↻</button></div>
   :user&&<>
    <div className="section-kicker"><span/> YOUR TRADEMATE SPACE</div>
    <h1>Good to have you<br/><span>{user.display_name.split(' ')[0]}.</span></h1>
    <p className="account-lead">Your TradeMate account and seller workspace are managed here.</p>
    <div className="account-card"><div className="account-avatar">{user.display_name.trim().charAt(0).toUpperCase()}</div><div><strong>{user.display_name}</strong><span>{user.email}</span><small>TRADEMATE MEMBER</small></div><i>●</i></div>
    {organization?
     <div className="account-next">
      <div className="section-kicker"><span/> BUSINESS SPACE CREATED</div>
      <h2>{organization.name}</h2>
      <p>Your business space has been saved. Its current status is <strong>{organization.status}</strong>; this does not yet publish products or enable payments.</p>
      <div className="account-steps"><span>01 <b>Account created</b><i>Complete</i></span><span>02 <b>Business setup</b><i>Complete</i></span><span>03 <b>Create an offer</b><i>Next</i></span></div>
      <div className="account-card"><div><strong>{organization.country_code} · {organization.default_currency}</strong><span>{organization.organization_type.replaceAll('_',' ')}</span><small>BUSINESS SPACE · {organization.status.toUpperCase()}</small></div></div>
      <Link className="cta-primary detail-back" href="/offers/new">Create an offer ↗</Link><Link className="account-secondary-link" href="/offers">Manage my offers →</Link><Link className="account-secondary-link" href="/messages">View buyer–seller enquiries →</Link><Link className="account-secondary-link" href="/#market">Explore the marketplace</Link>
     </div>
     :<div className="account-next">
      <div className="section-kicker"><span/> NEXT MILESTONE</div><h2>Bring your business into the market.</h2>
      <p>Set up your business identity and prepare to publish products or services. Listing creation comes next.</p>
      <div className="account-steps"><span>01 <b>Account created</b><i>Complete</i></span><span>02 <b>Business setup</b><i>Next</i></span><span>03 <b>Publish an offer</b><i>Coming next</i></span></div>
      <Link className="cta-primary detail-back" href="/business">Set up business space ↗</Link><Link className="account-secondary-link" href="/#market">Explore the marketplace</Link>
     </div>}
   </>}
  </section>
  <footer className="footer3"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><span>TRADE SMART. TRADE DIRECT.</span><Link href="/#top">BACK TO MARKET ↑</Link></footer>
 </main>;
}
