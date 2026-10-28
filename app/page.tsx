'use client';

import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ConfigError, Login, ResetPassword } from '@/components/auth/login';
import { Dashboard } from '@/components/dashboard/dashboard';

// Typing the emailed reset code signs the client in. This flag (kept per tab) keeps them on the "new password" screen
// even if they reload the page before choosing a password, instead of dropping them into the dashboard.
const RECOVERY_KEY = 'mieflow:recovery';

function rememberRecovery(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(RECOVERY_KEY, '1');
    else window.sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // storage blocked (private mode): the flag is only a convenience
  }
}

export default function Home(){
 const [session,setSession]=useState<any>(null),[authLoading,setAuthLoading]=useState(true);
 // true while the client is on the "set a new password" screen: after typing the emailed code, or after opening an older reset link
 const [recovery,setRecoveryState]=useState(false);
 const setRecovery=useCallback((on:boolean)=>{setRecoveryState(on);rememberRecovery(on)},[]);
 useEffect(()=>{
  if(!isSupabaseConfigured){setAuthLoading(false);return;}
  let remembered=false;
  try{remembered=window.sessionStorage.getItem(RECOVERY_KEY)==='1'}catch{}
  if(remembered||/type=recovery/.test(window.location.hash))setRecoveryState(true);
  supabase.auth.getSession().then(({data})=>{
   // A reset flag without a session (expired link, abandoned reset) must not hijack the next normal sign-in.
   if(!data.session)setRecovery(false);
   setSession(data.session);setAuthLoading(false)
  });
  const {data}=supabase.auth.onAuthStateChange((event,s)=>{
   // The emailed code and the reset link both sign the user in; without this they would land in the dashboard without choosing a new password.
   if(event==='PASSWORD_RECOVERY')setRecovery(true);
   if(event==='SIGNED_OUT')setRecovery(false);
   setSession(s);
  });
  return()=>data.subscription.unsubscribe();
 },[setRecovery]);
 if(!isSupabaseConfigured)return <ConfigError/>;
 if(authLoading)return <div className="auth-screen"><div className="spinner"/> Memuat Mieflow…</div>;
 if(!session)return <Login onRecoveryStart={()=>setRecovery(true)} onRecoveryCancel={()=>setRecovery(false)}/>;
 if(recovery)return <ResetPassword email={session.user?.email} onDone={()=>setRecovery(false)}/>;
 return <Dashboard session={session}/>;
}
