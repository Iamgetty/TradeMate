'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type ListingDetail = { id:string; title:string; description:string; listing_type:'product'|'service'; price_minor_units:string; currency_code:string; country_code:string; quantity_available:number|null; seller_name:string; category_name:string|null; media:{url:string;alt:string}[] };
const API_BASE = ''.replace(/\/$/,'');
const money=(minor:string,currency:string)=>{const n=Number(minor)/100;try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(n)}catch{return currency+' '+n.toLocaleString()}};
export default function ListingDetailPage(){
 const params=useParams<{id:string}>();
 const [listing,setListing]=useState<ListingDetail|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [sending,setSending]=useState(false);
 const [enquiryNotice,setEnquiryNotice]=useState<{kind:'success'|'error';text:string}|null>(null);
 useEffect(()=>{if(!params?.id)return;let cancelled=false;(async()=>{try{const response=await fetch(API_BASE+'/api/market/listings/'+encodeURIComponent(params.id),{cache:'no-store'});if(!response.ok)throw new Error(response.status===404?'This offer is no longer available.':'Could not load this offer. Please try again.');const body=await response.json();if(!cancelled)setListing(body.data)}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load this offer.')}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[params?.id]);
 async function sendEnquiry(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setEnquiryNotice(null);
  const clean=message.trim();
  if(clean.length<5||clean.length>2000){setEnquiryNotice({kind:'error',text:'Write a message between 5 and 2,000 characters.'});return}
  if(!listing)return;
  setSending(true);
  try{
   const response=await fetch(API_BASE+'/api/market/enquiries',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({listingId:listing.id,message:clean})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok){
    if(response.status===401){setEnquiryNotice({kind:'error',text:'Please log in to contact this seller. Your message is still here, so you can send it after signing in.'});return}
    throw new Error(typeof body.message==='string'?body.message:'Your enquiry could not be sent. Please try again.');
   }
   setEnquiryNotice({kind:'success',text:'Your enquiry has been sent to the seller.'});setMessage('');
  }catch(e){setEnquiryNotice({kind:'error',text:e instanceof Error?e.message:'Could not connect to TradeMate. Please try again.'})}
  finally{setSending(false)}
 }
 return <main className="web3-shell detail-shell"><header className="top-nav"><a className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></a><a className="nav-pill" href="/#market">← Back to marketplace</a></header><section className="detail-wrap">{loading?<div className="market-state"><div className="empty-orb3"><span>◈</span></div><h3>Finding this offer…</h3><p>Loading listing details.</p></div>:error?<div className="market-state"><div className="state-orb">!</div><h3>Offer unavailable</h3><p>{error}</p><a className="cta-primary detail-back" href="/#market">Explore the market ↗</a></div>:listing&&<div className="detail-layout"><div className="detail-media">{listing.media?.length?listing.media.map((m,i)=><img key={m.url+i} src={m.url} alt={m.alt||listing.title}/>):<div className="detail-art"><div className="offer-orbit"/><span>{listing.listing_type==='service'?'✳':'◈'}</span><small>TRADEMATE / OFFER</small></div>}</div><div className="detail-copy"><div className="section-kicker"><span/> MARKETPLACE OFFER</div><div className="detail-type">{listing.listing_type}{listing.category_name?' / '+listing.category_name:''}</div><h1>{listing.title}</h1><div className="detail-price">{money(listing.price_minor_units,listing.currency_code)}</div><p className="detail-description">{listing.description||'The seller has not added a description yet. Contact the seller for more details.'}</p><div className="detail-facts"><div><span>SELLER</span><strong>{listing.seller_name}</strong></div><div><span>MARKET</span><strong>{listing.country_code}</strong></div><div><span>AVAILABILITY</span><strong>{listing.quantity_available===null?'Ask seller':listing.quantity_available===0?'Out of stock':listing.quantity_available+' available'}</strong></div></div><div className="detail-note">TradeMate connects you with the people behind the offer. Always confirm seller identity, product details, and terms before making a payment.</div><section aria-labelledby="enquiry-heading" style={{marginTop:'1.5rem',padding:'1.25rem',border:'1px solid rgba(140,160,180,.25)',borderRadius:'16px'}}><div className="section-kicker"><span/> START A CONVERSATION</div><h2 id="enquiry-heading" style={{margin:'0.6rem 0',fontSize:'1.35rem'}}>Contact the seller</h2><p style={{margin:'0 0 1rem',opacity:.8}}>Ask about availability, delivery, pricing, or the details of this offer.</p><form onSubmit={sendEnquiry}><label htmlFor="seller-enquiry" style={{display:'block',marginBottom:'.5rem'}}>Your message</label><textarea id="seller-enquiry" value={message} onChange={e=>setMessage(e.target.value)} minLength={5} maxLength={2000} required rows={5} placeholder="Hi, I’m interested in this offer. Could you tell me more?" style={{boxSizing:'border-box',width:'100%',padding:'.9rem',borderRadius:'10px',border:'1px solid rgba(140,160,180,.4)',background:'transparent',color:'inherit',font:'inherit',resize:'vertical'}}/><div style={{display:'flex',justifyContent:'space-between',gap:'1rem',alignItems:'center',marginTop:'.5rem',fontSize:'.8rem',opacity:.75}}><span>{message.trim().length}/2000 characters</span><span>Sent privately to the seller</span></div><button className="cta-primary detail-back" type="submit" disabled={sending} style={{marginTop:'1rem',cursor:sending?'wait':'pointer',opacity:sending ? 0.65 : 1}}>{sending?'Sending enquiry…':'Send enquiry ↗'}</button>{enquiryNotice&&<p role="status" aria-live="polite" style={{marginTop:'.85rem',color:enquiryNotice.kind==='success'?'#3dbb86':'#d97757'}}>{enquiryNotice.text}{enquiryNotice.kind==='error'&&enquiryNotice.text.startsWith('Please log in')?' ':''}{enquiryNotice.kind==='error'&&enquiryNotice.text.startsWith('Please log in')&&<a href="/auth" style={{textDecoration:'underline',marginLeft:'.3rem'}}>Log in ↗</a>}</p>}</form></section><a className="cta-primary detail-back" href="/#market">← Continue exploring</a></div></div>}</section><footer className="footer3"><a className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></a><span>TRADE SMART. TRADE DIRECT.</span><a href="/#top">BACK TO TOP ↑</a></footer></main>;
}
