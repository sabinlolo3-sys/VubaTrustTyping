import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR-PROJECT')
  ? createClient(supabaseUrl, supabaseKey)
  : null;
const passages = [
  'Digital skills help learners study, communicate, and prepare for future opportunities.',
  'Practice a little every day. Accuracy comes first, and speed will grow with confidence.',
  'Technology creates opportunities when people have the skills and confidence to use it.',
  'Learning together makes practice more enjoyable. Encourage others and celebrate progress.'
];
const sampleWords = ['practice','learn','focus','keyboard','community','progress','future','accuracy','confidence','digital','skills','typing','school','create','improve','every','day','together','opportunity','build'];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [dark, setDark] = useState(false);
  const [mode, setMode] = useState('practice');
  const [passage, setPassage] = useState(passages[0]);
  const [typed, setTyped] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [seconds, setSeconds] = useState(30);
  const [remaining, setRemaining] = useState(30);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); setHistory([]); return; }
    loadProfileAndHistory();
  }, [session]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { window.clearInterval(timer); setRunning(false); setFinished(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => { loadLeaderboard(); }, []);

  async function loadProfileAndHistory() {
    if (!supabase || !session?.user) return;
    const user = session.user;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setProfile(p);
    const { data, error } = await supabase.from('test_results').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    if (!error) setHistory(data || []);
  }

  async function loadLeaderboard() {
    if (!supabase) return;
    const { data, error } = await supabase.from('public_leaderboard').select('*').limit(10);
    if (!error) setLeaderboard(data || []);
  }

  async function signIn() {
    if (!supabase) { setMessage('Connect Supabase first: copy .env.example to .env.local and add your project URL and public key.'); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setMessage(error.message);
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setMessage(''); }

  const correctChars = useMemo(() => {
    let count = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === passage[i]) count++;
    return count;
  }, [typed, passage]);
  const accuracy = typed.length ? Math.round((correctChars / typed.length) * 100) : 100;
  const elapsed = startedAt ? Math.max(1, Math.min(seconds, seconds - remaining)) : 0;
  const wpm = elapsed ? Math.round((correctChars / 5) / (elapsed / 60)) : 0;

  function beginTest() {
    setTyped(''); setRemaining(seconds); setStartedAt(Date.now()); setFinished(false); setLatest(null); setRunning(true); setMessage('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function resetTest() {
    setRunning(false); setFinished(false); setTyped(''); setRemaining(seconds); setStartedAt(null);
    setPassage(passages[Math.floor(Math.random() * passages.length)]);
  }
  async function finishAndSave() {
    setRunning(false); setFinished(true);
    const duration = Math.max(1, seconds - remaining);
    const finalWpm = Math.round((correctChars / 5) / (duration / 60));
    const result = { wpm: finalWpm, accuracy, test_mode: 'practice', test_duration: seconds, correct_chars: correctChars };
    setLatest(result);
    if (supabase && session?.user) {
      const { error } = await supabase.from('test_results').insert({ user_id: session.user.id, wpm: finalWpm, accuracy, test_mode: 'practice', test_duration: seconds });
      if (error) setMessage(`Test finished, but result could not be saved: ${error.message}`);
      else { setMessage('Your result was saved. Keep practising!'); loadProfileAndHistory(); loadLeaderboard(); }
    } else setMessage('Practice complete. Sign in and connect Supabase to save your results across sessions.');
  }
  function onTyping(e) {
    if (!running) return;
    const value = e.target.value.slice(0, passage.length);
    setTyped(value);
    if (value.length >= passage.length) { const elapsedSeconds = Math.min(seconds, Math.max(1, Math.ceil((Date.now() - (startedAt || Date.now())) / 1000))); setRemaining(Math.max(0, seconds - elapsedSeconds)); setRunning(false); setFinished(true); }
  }

  return <div className={dark ? 'app dark' : 'app'}>
    <header className="nav wrap">
      <a className="brand" href="#home"><span className="brand-mark">V</span><span>Vuba<span className="brand-light">TrustTyping</span></span></a>
      <nav><a href="#practice">Practice</a><a href="#how">How it works</a><a href="#leaderboard">Leaderboard</a></nav>
      <div className="nav-actions"><button className="icon-btn" onClick={() => setDark(v => !v)} aria-label="Toggle theme">{dark ? '☀' : '◐'}</button>{session ? <button className="button button-outline" onClick={signOut}>Sign out</button> : <button className="button button-primary" onClick={signIn}>Sign in</button>}</div>
    </header>
    <main>
      <section id="home" className="hero wrap">
        <div className="hero-copy"><div className="eyebrow"><span className="dot"/> DIGITAL SKILLS. REAL PROGRESS.</div><h1>Build your typing speed.<br/><span>Unlock your potential.</span></h1><p className="hero-text">A friendly place to practise typing, measure your progress, and build confidence using computers — one session at a time.</p><div className="hero-actions"><a className="button button-primary" href="#practice">Start practising <span>→</span></a><a className="text-link" href="#how">How it works <span>↗</span></a></div><div className="hero-proof"><div className="avatar-stack"><span>V</span><span>+</span><span>↗</span></div><p><strong>Progress over perfection.</strong><br/>Every learner can improve.</p></div></div>
        <div className="hero-visual"><div className="visual-glow"/><div className="typing-card"><div className="card-top"><span className="window-dots"><i/><i/><i/></span><span className="live-label"><b/> PRACTICE MODE</span></div><div className="mock-stats"><div><small>WPM</small><strong>42</strong></div><div><small>ACCURACY</small><strong>96<span>%</span></strong></div><div><small>TIME</small><strong>0:30</strong></div></div><div className="mock-text"><span className="typed-word">Learning</span> <span className="typed-word">digital</span> <span className="typed-word">skills</span> <span className="cursor-word">opens</span> new opportunities for everyone.</div><div className="mini-chart"><div style={{height:'24%'}}/><div style={{height:'35%'}}/><div style={{height:'30%'}}/><div style={{height:'48%'}}/><div style={{height:'42%'}}/><div style={{height:'68%'}}/><div style={{height:'59%'}}/><div style={{height:'82%'}}/><div style={{height:'75%'}}/><div style={{height:'100%'}}/><div style={{height:'86%'}}/></div><div className="card-bottom"><span>YOUR SKILLS, YOUR PACE</span><span className="trend">↗ Improving</span></div></div><div className="floating-badge badge-speed"><span>⚡</span><div><strong>+12 WPM</strong><small>Personal best</small></div></div><div className="floating-badge badge-streak"><span>✓</span><div><strong>Practice streak</strong><small>One session at a time</small></div></div><div className="circle-decoration circle-one"/><div className="circle-decoration circle-two"/></div>
      </section>
      <section className="stats-strip"><div className="wrap stats-inner"><div><strong>Practice</strong><span>at your own pace</span></div><div><strong>Track</strong><span>your improvement</span></div><div><strong>Compete</strong><span>in friendly races</span></div><div><strong>Grow</strong><span>your digital confidence</span></div></div></section>
      <section id="practice" className="section wrap"><div className="section-heading"><div><div className="eyebrow">YOUR NEXT SESSION</div><h2>Small practice. <span>Big progress.</span></h2><p>Type the passage below. Focus on accuracy first; speed follows with practice.</p></div><div className="session-control"><label htmlFor="duration">Test length</label><select id="duration" value={seconds} onChange={e => { setSeconds(Number(e.target.value)); setRemaining(Number(e.target.value)); }} disabled={running}><option value={15}>15 seconds</option><option value={30}>30 seconds</option><option value={60}>60 seconds</option></select></div></div>
        <div className="practice-panel"><div className="practice-top"><div className="practice-label"><span className="pulse-dot"/> TYPING PRACTICE</div><div className="live-metrics"><div><small>WPM</small><strong>{running ? wpm : (latest?.wpm ?? '—')}</strong></div><div><small>ACCURACY</small><strong>{running || typed ? accuracy : '—'}{running || typed ? '%' : ''}</strong></div><div><small>TIME LEFT</small><strong>00:{String(remaining).padStart(2,'0')}</strong></div></div></div>
          <div className="passage" onClick={() => inputRef.current?.focus()}>{passage.split('').map((char,i)=><span key={i} className={i < typed.length ? (typed[i] === char ? 'char-correct' : 'char-wrong') : i === typed.length && running ? 'char-current' : ''}>{char}</span>)}</div>
          <textarea ref={inputRef} className="typing-input" aria-label="Type the passage here" placeholder={running ? 'Keep typing here…' : 'Press “Start test” to begin, then type here…'} value={typed} onChange={onTyping} disabled={!running} spellCheck="false" autoCapitalize="off" autoCorrect="off" />
          <div className="practice-bottom"><span className="keyboard-hint">Tip: accuracy first — don't rush.</span><div className="practice-buttons">{running ? <button className="button button-primary" onClick={finishAndSave}>Finish & save</button> : finished && !latest ? <button className="button button-primary" onClick={finishAndSave}>Save result</button> : <button className="button button-primary" onClick={beginTest}>{finished ? 'Try again' : 'Start test'} <span>→</span></button>}{finished && latest && <button className="button button-outline" onClick={beginTest}>Try again</button>}<button className="button button-outline" onClick={resetTest}>Reset</button></div></div>
          {finished && <div className="result-banner"><strong>Session complete.</strong> {latest ? `Your result: ${latest.wpm} WPM at ${latest.accuracy}% accuracy.` : `Your result: ${wpm} WPM at ${accuracy}% accuracy.`} {session ? 'Your result will be saved when you finish the test.' : 'Sign in to save your progress.'}</div>}
        </div>
        {message && <div className="notice" role="status">{message}</div>}
      </section>
      <section id="how" className="section section-muted"><div className="wrap"><div className="center-heading"><div className="eyebrow">A SIMPLE WAY TO GROW</div><h2>Better typing starts <span>with a routine.</span></h2><p>Build a skill that supports your learning, work, and everyday digital life.</p></div><div className="steps-grid"><article className="step-card"><div className="step-number">01</div><div className="step-icon">⌨</div><h3>Practise regularly</h3><p>Short, focused sessions help you build familiarity with the keyboard.</p></article><article className="step-card"><div className="step-number">02</div><div className="step-icon">↗</div><h3>See your progress</h3><p>Use speed and accuracy results to understand what is improving.</p></article><article className="step-card"><div className="step-number">03</div><div className="step-icon">✦</div><h3>Celebrate growth</h3><p>Set personal goals, encourage your peers, and keep learning together.</p></article></div></div></section>
      <section id="leaderboard" className="section wrap"><div className="section-heading"><div><div className="eyebrow">COMMUNITY PROGRESS</div><h2>Who's <span>improving?</span></h2><p>Celebrate progress and encourage each other to keep practising.</p></div></div><div className="leaderboard-panel"><div className="leaderboard-head"><strong>Top typists</strong><span>Best recorded WPM</span></div>{leaderboard.length ? leaderboard.map((row,i)=><div className="leader-row" key={row.user_id || i}><span className="rank">{i+1}</span><span className="leader-avatar">{(row.display_name || 'T').slice(0,1).toUpperCase()}</span><span className="leader-name">{row.display_name || 'Learner'}</span><strong>{row.best_wpm} <small>WPM</small></strong></div>) : <div className="empty-state">{supabase ? 'The leaderboard will appear when learners have saved results and chosen to share a public display name.' : 'Connect Supabase to display the community leaderboard.'}</div>}</div><p className="privacy-note">Public leaderboard participation should be optional, especially for learners under 18.</p></section>
      {session && <section className="section section-muted"><div className="wrap dashboard"><div><div className="eyebrow">YOUR SPACE</div><h2>Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h2><p>Your recent practice results are shown here when available.</p></div><div className="history-card"><h3>Recent sessions</h3>{history.length ? history.map(item=><div className="history-row" key={item.id}><span>{new Date(item.created_at).toLocaleDateString()}</span><strong>{item.wpm} WPM</strong><span>{item.accuracy}% accuracy</span></div>) : <p className="empty-state">Complete a test while signed in to start your progress history.</p>}</div></div></section>}
      <section className="cta-section"><div className="wrap cta-inner"><div><div className="eyebrow">EVERY KEYSTROKE COUNTS</div><h2>Start where you are.<br/><span>Grow from there.</span></h2><p>Make practice a habit and build confidence, one session at a time.</p></div><a href="#practice" className="button button-light">Start practising <span>→</span></a></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-inner"><a className="brand" href="#home"><span className="brand-mark">V</span><span>Vuba<span className="brand-light">TrustTyping</span></span></a><p>Practice with purpose. Grow together.</p><span>© {new Date().getFullYear()} VubaTrustTyping</span></div></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
