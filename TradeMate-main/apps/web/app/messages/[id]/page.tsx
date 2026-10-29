'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type ThreadMessage = {
 id: string;
 sender_user_id: string;
 sender_name: string;
 message: string;
 created_at: string;
 initial?: boolean;
};
type Enquiry = {
 id: string;
 listing_id: string;
 listing_title: string;
 buyer_user_id: string;
 buyer_name: string;
 seller_name: string;
 status: 'open' | 'responded' | 'closed' | 'reported';
};
const API_BASE = ''; // Use the same-origin Next.js proxy so session cookies persist.
const stamp = (value: string) => {
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? 'Just now' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function EnquiryThreadPage() {
 const params = useParams<{ id: string }>();
 const id = params.id;
 const router = useRouter();
 const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
 const [messages, setMessages] = useState<ThreadMessage[]>([]);
 const [draft, setDraft] = useState('');
 const [loading, setLoading] = useState(true);
 const [sending, setSending] = useState(false);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');

 const load = useCallback(async () => {
  setError('');
  try {
   const response = await fetch(API_BASE + '/api/market/enquiries/' + encodeURIComponent(id) + '/messages', { credentials: 'include', cache: 'no-store' });
   if (response.status === 401) { router.replace('/auth?mode=login'); return; }
   if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Could not load this conversation.');
   }
   const body = await response.json();
   setEnquiry(body.data.enquiry);
   setMessages(Array.isArray(body.data.messages) ? body.data.messages : []);
  } catch (e) {
   setError(e instanceof Error ? e.message : 'A connection issue occurred.');
  } finally {
   setLoading(false);
  }
 }, [id, router]);

 useEffect(() => { void load(); }, [load]);

 async function send(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const message = draft.trim();
  if (!message || sending) return;
  setSending(true); setError(''); setNotice('');
  try {
   const response = await fetch(API_BASE + '/api/market/enquiries/' + encodeURIComponent(id) + '/messages', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
   });
   const body = await response.json().catch(() => ({}));
   if (response.status === 401) { router.replace('/auth?mode=login'); return; }
   if (!response.ok) throw new Error(body.message || 'Your reply could not be sent.');
   setDraft('');
   setNotice('Reply sent.');
   await load();
  } catch (e) {
   setError(e instanceof Error ? e.message : 'A connection issue occurred.');
  } finally { setSending(false); }
 }

 const closed = enquiry?.status === 'closed' || enquiry?.status === 'reported';
 return <main className="web3-shell account-shell">
  <header className="top-nav"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><Link className="nav-pill" href="/messages">← Conversations</Link></header>
  <section className="account-wrap">
   <div className="section-kicker"><span/> BUYER–SELLER CONNECTIONS</div>
   <h1>{enquiry?.listing_title || 'Conversation'}<span>.</span></h1>
   <p className="account-lead">A direct conversation between buyer and seller. Keep communication and deal details inside TradeMate.</p>
   {loading ? <div className="market-state"><h3>Loading conversation…</h3><p>Checking your secure TradeMate session.</p></div> :
    error && !enquiry ? <div className="market-state"><h3>Conversation unavailable</h3><p>{error}</p><button className="retry-btn" onClick={() => { setLoading(true); void load(); }}>Try again ↻</button></div> :
    enquiry ? <>
     <div style={{display:'flex',gap:'.65rem',flexWrap:'wrap',alignItems:'center',margin:'1.25rem 0'}}><span style={{padding:'.35rem .7rem',border:'1px solid #ffffff22',borderRadius:'999px',fontSize:'.8rem',textTransform:'capitalize'}}>Status: {enquiry.status}</span><Link href={'/market/'+enquiry.listing_id} style={{color:'#9effc7'}}>View offer ↗</Link><button type="button" onClick={() => { setLoading(true); void load(); }} style={{marginLeft:'auto',padding:'.55rem .85rem',borderRadius:'999px',border:'1px solid #34444b',background:'transparent',color:'inherit'}}>Refresh ↻</button></div>
     <div style={{display:'grid',gap:'.85rem',margin:'1.25rem 0'}}>
      {messages.map(item => <article key={item.id} style={{maxWidth:'min(100%, 720px)',justifySelf:item.sender_user_id===enquiry.buyer_user_id?'start':'end',width:'fit-content',padding:'1rem 1.1rem',border:'1px solid '+(item.initial?'#9effc755':'#ffffff1a'),borderRadius:'16px',background:item.initial?'#9effc70d':'#ffffff06',overflowWrap:'anywhere'}}>
       <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap',fontSize:'.78rem',opacity:.75}}><strong>{item.sender_name || (item.sender_user_id===enquiry.buyer_user_id?'Buyer':'Seller')}</strong><span>{stamp(item.created_at)}</span></div>
       <p style={{whiteSpace:'pre-wrap',lineHeight:1.65,margin:'.65rem 0 0'}}>{item.message}</p>
      </article>)}
      {!messages.length && <p>No messages yet. Start the conversation below.</p>}
     </div>
     {error && <p role="alert" style={{color:'#ff9e9e'}}>{error}</p>}
     {notice && <p role="status" style={{color:'#9effc7'}}>{notice}</p>}
     {closed ? <div className="market-state"><h3>This conversation is closed</h3><p>Replies are disabled for closed or reported enquiries.</p></div> :
      <form onSubmit={send} style={{display:'grid',gap:'.75rem',marginTop:'1.5rem'}}>
       <label htmlFor="reply-message">Your reply</label>
       <textarea id="reply-message" value={draft} onChange={event=>setDraft(event.target.value)} minLength={1} maxLength={2000} required rows={4} placeholder="Write a clear message to the buyer or seller…" style={{width:'100%',resize:'vertical',padding:'1rem',borderRadius:'14px',border:'1px solid #ffffff24',background:'#ffffff06',color:'inherit',font:'inherit'}} />
       <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',alignItems:'center',flexWrap:'wrap'}}><small style={{opacity:.7}}>{draft.length}/2000 characters</small><button className="cta-primary" type="submit" disabled={sending || !draft.trim()}>{sending?'Sending…':'Send reply ↗'}</button></div>
      </form>}
    </> : null}
   <p style={{marginTop:'1.5rem',fontSize:'.85rem',opacity:.7}}>Do not share passwords, wallet recovery phrases, or private keys in messages.</p>
  </section>
  <footer className="footer3"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><span>TRADE SMART. TRADE DIRECT.</span><Link href="/messages">ALL CONVERSATIONS ↑</Link></footer>
 </main>;
}
