'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Enquiry = {
 id:string; listing_id:string; message:string; status:'open'|'responded'|'closed'|'reported';
 created_at:string; updated_at:string; listing_title:string; currency_code:string;
 price_minor_units:string|null; seller_name:string; buyer_name:string; direction:'sent'|'received';
};
const API_BASE = ''; // Use the same-origin Next.js proxy so session cookies persist.
const dateLabel=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Recently':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date)};
const money=(minor:string|null,currency:string)=>{if(minor===null)return 'Price on request';try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(Number(minor)/100)}catch{return currency+' '+(Number(minor)/100).toLocaleString()}};
export default function MessagesPage(){
 const router=useRouter();
 const [items,setItems]=useState<Enquiry[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [filter,setFilter]=useState<'all'|'received'|'sent'>('all');
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let cancelled=false;(async()=>{try{
  const response=await fetch(API_BASE+'/api/market/enquiries/mine',{credentials:'include',cache:'no-store'});
  if(response.status===401){router.replace('/auth?mode=login');return}
  if(!response.ok)throw new Error('Could not load your enquiries. Please try again.');
  const body=await response.json();if(!cancelled)setItems(Array.isArray(body.data)?body.data:[]);
 }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'A connection issue occurred.')}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[router,refresh]);
 const visible=items.filter(item=>filter==='all'||item.direction===filter);
 return <main className="web3-shell account-shell">
  <header className="top-nav"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><Link className="nav-pill" href="/account">← My space</Link></header>
  <section className="account-wrap">
   <div className="section-kicker"><span/> BUYER–SELLER CONNECTIONS</div>
   <h1>Your conversations<span>.</span></h1>
   <p className="account-lead">Keep track of the enquiries you send and the interest your offers receive.</p>
   <div style={{display:'flex',gap:'.6rem',flexWrap:'wrap',margin:'1.5rem 0'}}>
    {(['all','received','sent'] as const).map(value=><button key={value} type="button" onClick={()=>setFilter(value)} aria-pressed={filter===value} style={{padding:'.65rem 1rem',borderRadius:'999px',border:'1px solid '+(filter===value?'#9effc7':'#34444b'),background:filter===value?'#9effc71a':'transparent',color:'inherit'}}>{value==='all'?'All enquiries':value==='received'?'Received':'Sent'}{value==='all'?' · '+items.length:''}</button>)}
    <button type="button" onClick={()=>{setLoading(true);setError('');setRefresh(v=>v+1)}} style={{marginLeft:'auto',padding:'.65rem 1rem',borderRadius:'999px',border:'1px solid #34444b',background:'transparent',color:'inherit'}}>Refresh ↻</button>
   </div>
   {loading?<div className="market-state"><div className="empty-orb3"><span>◈</span></div><h3>Gathering your conversations…</h3><p>Checking your secure TradeMate session.</p></div>
   :error?<div className="market-state"><div className="state-orb">!</div><h3>Inbox unavailable</h3><p>{error}</p><button className="retry-btn" onClick={()=>{setLoading(true);setRefresh(v=>v+1)}}>Try again ↻</button></div>
   :visible.length===0?<div className="market-state"><div className="empty-orb3"><span>↗</span></div><h3>{filter==='all'?'Your next connection starts here.':filter==='sent'?'No enquiries sent yet.':'No seller enquiries yet.'}</h3><p>When you contact a seller or someone enquires about your offer, the conversation will appear here.</p><Link className="cta-primary detail-back" href="/#market">Explore marketplace ↗</Link></div>
   :<div style={{display:'grid',gap:'.85rem'}}>{visible.map(item=><article key={item.id} style={{padding:'1.15rem',border:'1px solid #ffffff1a',borderRadius:'14px',background:'#ffffff04'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',alignItems:'flex-start',flexWrap:'wrap'}}><div><div className="section-kicker"><span/>{item.direction==='sent'?'YOU CONTACTED THE SELLER':'BUYER ENQUIRY RECEIVED'}</div><h2 style={{fontSize:'1.15rem',margin:'.65rem 0 .35rem'}}>{item.listing_title}</h2><p style={{margin:0,opacity:.75,fontSize:'.9rem'}}>{item.direction==='sent'?'Seller: '+item.seller_name:'Buyer: '+item.buyer_name}</p></div><span style={{padding:'.35rem .6rem',borderRadius:'999px',border:'1px solid #ffffff22',fontSize:'.75rem',textTransform:'capitalize'}}>{item.status}</span></div>
    <p style={{lineHeight:1.6,overflowWrap:'anywhere'}}>{item.message}</p>
    <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',alignItems:'center',flexWrap:'wrap',fontSize:'.8rem',opacity:.75}}><span>{dateLabel(item.created_at)} · {money(item.price_minor_units,item.currency_code)}</span><div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}><Link href={'/messages/'+item.id} style={{color:'#9effc7'}}>Open conversation ↗</Link><Link href={'/market/'+item.listing_id} style={{color:'#9effc7'}}>View offer ↗</Link></div></div>
   </article>)}</div>}
   <p style={{marginTop:'1.5rem',fontSize:'.85rem',opacity:.7}}>Open any enquiry to continue the conversation with the buyer or seller.</p>
  </section>
  <footer className="footer3"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><span>TRADE SMART. TRADE DIRECT.</span><Link href="/#top">BACK TO MARKET ↑</Link></footer>
 </main>;
}
