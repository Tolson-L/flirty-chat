// FRONTEND — React
// Plan selector with per-month equivalent + Setup Wizard with checklist
import React, { useEffect, useMemo, useRef, useState } from "react";

const PERSONAS = [
  { id: "bella", name: "Bella", bio: "Glam & playful — cheeky banter.", avatar: "B", colors: { base: "bg-rose-100 text-rose-700", pill: "bg-rose-600 text-white" }, openers: ["Hey you… I was waiting 💋"], regularReplies: ["Cute. I like that.","Haha, bold!"], premiumReplies: ["Mmm… say that again, slower.","You’re kind of irresistible right now…"] },
  { id: "sasha", name: "Sasha", bio: "Energetic & supportive — a little competitive.", avatar: "S", colors: { base: "bg-emerald-100 text-emerald-700", pill: "bg-emerald-600 text-white" }, openers: ["Bet you can’t make me laugh 😉"], regularReplies: ["You’re trouble.","Spicy!"], premiumReplies: ["I like where this is going…","You’re making me blush."] },
  { id: "luna", name: "Luna", bio: "Elegant & curious — deeper chat.", avatar: "L", colors: { base: "bg-indigo-100 text-indigo-700", pill: "bg-indigo-600 text-white" }, openers: ["Tell me one secret."], regularReplies: ["Interesting. Why?","I want details."], premiumReplies: ["That’s deliciously personal. More…","I can feel your vibe…"] },
  { id: "chloe", name: "Chloe", bio: "Cute & upbeat — teasing.", avatar: "C", colors: { base: "bg-amber-100 text-amber-700", pill: "bg-amber-600 text-white" }, openers: ["Hiiiii! Miss me?"], regularReplies: ["Lol stop 😂","Adorable."], premiumReplies: ["Okaaay I’m blushing…","This is my fav version of you."] },
];

const FREE_LIMIT_COUNT = 15;
const FREE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
const FREE_PREMIUM_DAILY = 5;

const PRICING = { premium: { base: 5 }, ultra: { base: 15 } };
const PERIODS = [1,3,6,12];
const priceFor = (tier, months) => {
  const base = PRICING[tier].base;
  if (months === 1) return base;
  const subtotal = base * months;
  return +(subtotal * 0.95).toFixed(2);
};

function getUserId(){ let id = localStorage.getItem('fc_user'); if(!id){ id = Math.random().toString(36).slice(2); localStorage.setItem('fc_user', id);} return id; }
const now = () => Date.now();
const startOfLocalDay = (t=now()) => { const d=new Date(t); d.setHours(0,0,0,0); return d.getTime(); };

function AdBlock(){
  return (
    <div className="my-3 border rounded-lg p-3 text-xs text-gray-500 bg-gray-50">
      <div className="font-medium mb-1">Ad</div>
      <div>Place your AdSense <ins className="adsbygoogle">banner</ins> here.</div>
    </div>
  );
}

export default function App(){
  const userId = useMemo(getUserId, []);
  const [displayName,setDisplayName] = useState(localStorage.getItem('fc_name')||'');
  const [emoji,setEmoji] = useState(localStorage.getItem('fc_emoji')||'🙂');
  const [isLoggedIn,setIsLoggedIn] = useState(!!localStorage.getItem('fc_name'));

  const [premium,setPremium] = useState(false);
  const [vip,setVip] = useState(false);
  const [dark,setDark] = useState(false);

  const [selected,setSelected] = useState(PERSONAS[0].id);
  const [txt,setTxt] = useState('');
  const [typing,setTyping] = useState(false);
  const [convos,setConvos] = useState(()=>{ try{return JSON.parse(localStorage.getItem('fc_convos')||'{}')}catch{return{}}});

  const [freeCount,setFreeCount] = useState(()=>Number(localStorage.getItem('fc_free_count')||0));
  const [freeResetAt,setFreeResetAt] = useState(()=>Number(localStorage.getItem('fc_free_reset')||0));
  const [freePremiumLeft,setFreePremiumLeft] = useState(()=>{ const day=Number(localStorage.getItem('fc_prem_day')||0); const today=startOfLocalDay(); if(day!==today){ localStorage.setItem('fc_prem_day',String(today)); localStorage.setItem('fc_prem_left',String(FREE_PREMIUM_DAILY)); return FREE_PREMIUM_DAILY;} return Number(localStorage.getItem('fc_prem_left')||FREE_PREMIUM_DAILY);});
  const [sinceAd,setSinceAd] = useState(0);

  const [showPlan,setShowPlan] = useState(false);
  const [tier,setTier] = useState('premium');
  const [months,setMonths] = useState(1);

  // Setup Helper (admin)
  const [showHelper, setShowHelper] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState(null);
  const [adsenseId, setAdsenseId] = useState("");
  const [prices, setPrices] = useState({ premium: { M1: "", M3: "", M6: "", M12: "" }, ultra: { M1: "", M3: "", M6: "", M12: "" } });
  async function refreshStatus(){ try{ const r=await fetch('/api/status'); const d=await r.json(); setStatus(d.status||null);}catch{ setStatus(null);} }
  async function saveConfig(){ try{ const r = await fetch('/api/admin/config',{ method:'POST', headers:{'Content-Type':'application/json','X-Admin-Token':adminToken}, body: JSON.stringify({ adsenseClientId: adsenseId || null, prices }) }); const d = await r.json(); if(d?.ok){ alert('Saved!'); refreshStatus(); injectAdSense(adsenseId); } else { alert(d?.error||'Failed'); } }catch(e){ alert('Failed to save'); } }
  function injectAdSense(id){ if(!id) return; const script = document.getElementById('adsense-loader'); if (script && !script.src) { script.setAttribute('data-ad-client', id); script.setAttribute('async',''); script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'; } }

  const current = PERSONAS.find(p=>p.id===selected);
  const msgs = convos[selected] || [];
  const endRef = useRef(null);

  useEffect(()=>{ document.documentElement.classList.toggle('dark', dark); },[dark]);
  useEffect(()=>{ localStorage.setItem('fc_convos', JSON.stringify(convos)); },[convos]);
  useEffect(()=>{ localStorage.setItem('fc_free_count', String(freeCount)); localStorage.setItem('fc_free_reset', String(freeResetAt)); },[freeCount,freeResetAt]);
  useEffect(()=>{ localStorage.setItem('fc_prem_left', String(freePremiumLeft)); },[freePremiumLeft]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[convos,selected]);
  useEffect(()=>{ (async()=>{ try{ const r=await fetch('/api/me',{headers:{'X-User-Id':userId}}); if(r.ok){ const d=await r.json(); setPremium(!!d.premium); setVip(!!d.vip); setDark(!!d.dark);} }catch{}})(); },[userId]);

  function login(e){ e.preventDefault(); if(!displayName.trim()) return; localStorage.setItem('fc_name',displayName.trim()); localStorage.setItem('fc_emoji',emoji); setIsLoggedIn(true); }
  const withinWindow = ()=> freeResetAt && now() < freeResetAt;
  function ensureWindow(){ if(!withinWindow()){ setFreeCount(0); setFreeResetAt(now()+FREE_LIMIT_WINDOW_MS); }}
  function capRemaining(){ if(premium) return Infinity; ensureWindow(); return Math.max(0, FREE_LIMIT_COUNT - freeCount); }

  function genReply(text, persona){
    const premiumTone = premium || (freePremiumLeft>0);
    const lower = text.toLowerCase();
    if(lower.includes('hello')||lower.includes('hi')||lower.includes('hey')) return persona.openers[0];
    if(lower.includes('how are')) return 'Better now that you’re here. 😉';
    const bank = premiumTone ? persona.premiumReplies : persona.regularReplies;
    return bank[Math.floor(Math.random()*bank.length)];
  }

  async function send(){
    if(!isLoggedIn){ alert('Set your name first.'); return; }
    if(!txt.trim()) return;
    if(!premium){ ensureWindow(); if(freeCount>=FREE_LIMIT_COUNT){ alert('15-message limit reached. Upgrade to Premium for unlimited, ad‑free, more flirtatious chatting.'); return; } }

    const text = txt.trim(); setTxt('');
    const uMsg = { id: Math.random().toString(36).slice(2), from:'user', text, time: Date.now() };
    setConvos(p=>({ ...p, [selected]: [ ...(p[selected]||[]), uMsg ] }));
    if(!premium){ setFreeCount(c=>c+1); setSinceAd(c=>c+1); }

    if(!premium){ setTimeout(()=>{ setSinceAd(c=>{ if(c>=3){ const ad={id:Math.random().toString(36).slice(2), from:'system-ad', time:Date.now()}; setConvos(p=>({...p,[selected]:[...(p[selected]||[]), ad]})); return 0;} return c; }); },100); }

    setTyping(true);
    const delay = Math.min(2200, Math.max(900, text.length*60));
    setTimeout(()=>{
      const reply = genReply(text, current);
      const aMsg = { id: Math.random().toString(36).slice(2), from:'agent', who: current.name, text: reply, time: Date.now() };
      setConvos(p=>({ ...p, [selected]: [ ...(p[selected]||[]), aMsg ] }));
      setTyping(false);
      if(!premium && freePremiumLeft>0) setFreePremiumLeft(n=>n-1);
      if(premium){ try{ const u = new SpeechSynthesisUtterance(`${current.name} says: ${reply}`); speechSynthesis.speak(u); }catch{} }
    }, delay);
  }

  async function startCheckout(){
    try{
      const r = await fetch('/api/create-checkout-session',{ method:'POST', headers:{ 'Content-Type':'application/json','X-User-Id':userId }, body: JSON.stringify({ tier, periodMonths: months }) });
      const d = await r.json(); if(d?.url) window.location.href=d.url; else alert(d?.error||'Checkout failed');
    }catch(e){ console.error(e); alert('Checkout failed'); }
  }

  function Header(){
    const total = priceFor(tier, months);
    const perMonth = (total / months).toFixed(2);
    return (
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="text-2xl">💬</div>
          <div className="font-bold">Flirty Chat</div>
          {premium ? <span className="ml-2 text-xs px-2 py-1 rounded-full bg-purple-600 text-white">Premium</span> : <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-200">Free</span>}
        </div>
        <div className="flex items-center gap-3">
          {premium && (<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)} />Dark mode</label>)}
          {!premium && (
            <div className="relative">
              <button onClick={()=>setShowPlan(v=>!v)} className="px-3 py-2 rounded-lg bg-purple-600 text-white">Upgrade — More Flirtatious Chatting</button>
              {showPlan && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-3 shadow-xl z-50">
                  <div className="text-sm font-semibold mb-2">Choose your plan</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button onClick={()=>setTier('premium')} className={`p-2 rounded border ${tier==='premium'? 'border-purple-600':'border-gray-300 dark:border-gray-700'}`}>
                      Premium <div className="text-xs">$5/mo</div>
                    </button>
                    <button onClick={()=>setTier('ultra')} className={`p-2 rounded border ${tier==='ultra'? 'border-purple-600':'border-gray-300 dark:border-gray-700'}`}>
                      Ultra <div className="text-xs">$15/mo</div>
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Billing period</div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {PERIODS.map(m => (
                      <button key={m} onClick={()=>setMonths(m)} className={`p-2 rounded border text-xs ${months===m? 'border-purple-600':'border-gray-300 dark:border-gray-700'}`}>{m}m{m>1 && <span className="ml-1 text-[10px] text-green-600">5% off</span>}</button>
                    ))}
                  </div>
                  <div className="text-sm mb-3">
                    Total now: <span className="font-semibold">${total.toFixed(2)}</span>
                    <span className="ml-2 text-xs text-gray-500">≈ ${perMonth}/mo</span>
                  </div>
                  <button onClick={startCheckout} className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white">Continue to Checkout</button>
                </div>
              )}
            </div>
          )}
          {/* Setup AI Helper button */}
          <button onClick={()=>{ setShowHelper(true); refreshStatus(); }} className="px-3 py-2 rounded-lg border">Setup</button>
        </div>
      </div>
    );
  }

  function Sidebar(){
    return (
      <div className="p-4 border-r dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{emoji}</div>
          <div>
            {isLoggedIn ? (
              <div className="text-sm">Hi <span className="font-semibold">{displayName}</span></div>
            ) : (
              <form onSubmit={login} className="flex gap-2">
                <input className="border rounded p-2 dark:bg-gray-900 dark:border-gray-700" placeholder="Display name" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
                <input className="border rounded p-2 w-20 text-center dark:bg-gray-900 dark:border-gray-700" value={emoji} onChange={e=>setEmoji(e.target.value)} />
                <button className="px-3 py-2 bg-gray-900 text-white rounded">Join</button>
              </form>
            )}
            <div className="text-xs text-gray-500 mt-1">Daily bonus: {freePremiumLeft} flirt msgs</div>
            {!premium && (<div className="text-xs text-gray-500">Limit: {Math.max(0, FREE_LIMIT_COUNT - freeCount)} / {FREE_LIMIT_COUNT} (resets in {Math.max(0, Math.ceil((freeResetAt - now())/60000))}m)</div>)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Choose a companion</div>
          <div className="space-y-2">
            {PERSONAS.map(p=> (
              <button key={p.id} onClick={()=>setSelected(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl border dark:border-gray-700 ${selected===p.id?"ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-gray-900":""}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.colors.base}`}>{p.avatar}</div>
                <div className="text-left">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.bio}</div>
                </div>
                {vip && <span className={`ml-auto text-[10px] px-2 py-1 rounded-full ${p.colors.pill}`}>VIP</span>}
              </button>
            ))}
          </div>
        </div>

        {!premium && (<div className="mt-4"><div className="text-xs text-gray-500 mb-1">Sponsored</div><AdBlock /></div>)}
      </div>
    );
  }

  function Chat(){
    return (
      <div className="flex flex-col h-full">
        <Header />
        <div className="flex-1 p-4 overflow-y-auto space-y-2">
          {msgs.length===0 ? (
            <div className="text-center text-gray-500 mt-24">{current.openers[0]}</div>
          ) : (
            msgs.map(m => (
              m.from==='system-ad' ? (!premium && <AdBlock key={m.id} />) : (
                <div key={m.id} className={`flex ${m.from==='user'?'justify-end':'justify-start'}`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl my-1 text-sm break-words ${m.from==='user'?"bg-indigo-600 text-white rounded-br-none":"bg-gray-100 dark:bg-gray-800 dark:text-gray-100 text-gray-900 rounded-bl-none"}`}>
                    {m.text}
                    <div className="text-[10px] opacity-60 mt-1 text-right">{new Date(m.time).toLocaleTimeString()}</div>
                  </div>
                </div>
              )
            ))
          )}
          <div ref={endRef} />
        </div>
        <div className="p-4 border-t dark:border-gray-700">
          <div className="flex gap-2">
            <input className="flex-1 border rounded-lg p-3 dark:bg-gray-900 dark:border-gray-700" placeholder={premium?`Message ${current.name} (voice on)`: `Message ${current.name}`}
              value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }} />
            <button onClick={send} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Send</button>
          </div>
        </div>

        {/* Help / Setup */}
        <button onClick={()=>setShowHelper(true)} className="fixed bottom-4 right-4 px-4 py-3 rounded-full shadow-lg bg-black text-white">Help / Setup</button>

        {/* Setup AI Helper Modal */}
        {showHelper && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl p-4 border dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">AI Helper — Launch Setup</div>
                <button onClick={()=>setShowHelper(false)} className="text-sm">✕</button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Status</div>
                  <button onClick={refreshStatus} className="text-xs px-2 py-1 border rounded mb-2">Refresh</button>
                  <pre className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 overflow-auto max-h-60">{status? JSON.stringify(status, null, 2): 'No status yet. Click Refresh.'}</pre>

                  {/* Checklist */}
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-1">Go‑live checklist</div>
                    <ul className="list-disc ml-5 text-xs space-y-1">
                      <li>Stripe: Create Products & Prices → <a className="underline" href="https://dashboard.stripe.com/products" target="_blank" rel="noreferrer">Open</a></li>
                      <li>Copy 8 Price IDs (Premium/Ultra × 1/3/6/12m)</li>
                      <li>Set webhook to <code>/api/stripe/webhook</code> → <a className="underline" href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noreferrer">Open</a></li>
                      <li>AdSense Publisher ID (optional) → <a className="underline" href="https://adsense.google.com/" target="_blank" rel="noreferrer">Open</a></li>
                      <li>Paste values below and Save</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Configure</div>
                  <input className="w-full mb-2 p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="Admin token" value={adminToken} onChange={e=>setAdminToken(e.target.value)} />
                  <input className="w-full mb-2 p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="AdSense Publisher ID (e.g., ca-pub-XXXXXXXX)" value={adsenseId} onChange={e=>setAdsenseId(e.target.value)} />

                  <div className="text-xs text-gray-500 mb-1">Stripe Price IDs — Premium</div>
                  {['M1','M3','M6','M12'].map(k=> (
                    <input key={k} className="w-full mb-1 p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder={`PRICE_PREMIUM_${k}`} value={prices.premium[k]} onChange={e=>setPrices(p=>({...p, premium:{...p.premium, [k]: e.target.value}}))} />
                  ))}

                  <div className="text-xs text-gray-500 mt-2 mb-1">Stripe Price IDs — Ultra</div>
                  {['M1','M3','M6','M12'].map(k=> (
                    <input key={k} className="w-full mb-1 p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder={`PRICE_ULTRA_${k}`} value={prices.ultra[k]} onChange={e=>setPrices(p=>({...p, ultra:{...p.ultra, [k]: e.target.value}}))} />
                  ))}

                  <button onClick={saveConfig} className="mt-2 w-full px-3 py-2 rounded-lg bg-indigo-600 text-white">Save Config</button>
                  <p className="text-[11px] text-gray-500 mt-1">Server must still have <code>STRIPE_SECRET</code> & <code>WEBHOOK_SECRET</code> set as env vars.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${dark?"bg-gray-950 text-gray-100":"bg-white text-gray-900"} min-h-screen`}>
      <div className="max-w-6xl mx-auto shadow-md rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-[90vh] border dark:border-gray-800">
        <Sidebar />
        <div className="md:col-span-2"><Chat /></div>
      </div>
      <div className="text-center text-xs text-gray-500 my-3">Premium = ad‑free, unlimited, dark mode, voice, and <em>more flirtatious chatting</em>. Ultra adds VIP perks.</div>
    </div>
  );
}
