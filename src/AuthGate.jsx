import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

const C = { ink: "#14171B", paper: "#F3F4EF", card: "#FFFFFF", line: "#E1E3DC", accent: "#CFEE3A", mute: "#5B6470" };
const font = { display: "'Oswald','Arial Narrow',sans-serif", body: "'Manrope',system-ui,-apple-system,sans-serif" };

/* Wraps the app: shows a Google sign-in screen until a Supabase session
   exists, then renders children with the current session. */
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    setSending(true);
    setStatus("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setSending(false);
      setStatus(`Couldn't start Google sign-in: ${error.message}`);
    }
    // On success the browser is redirected to Google, so there's nothing else to do here.
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.paper, color: C.ink, fontFamily: font.body }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.paper, fontFamily: font.body, color: C.ink }}>
        <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
          <h1 className="text-2xl uppercase tracking-wide mb-1" style={{ fontFamily: font.display, fontWeight: 600 }}>
            Upright<span style={{ color: C.accent }}>.</span>
          </h1>
          <p className="text-sm mb-4" style={{ color: C.mute }}>
            Sign in with Google to load your training log.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={sending}
            className="w-full py-3 rounded-xl text-sm uppercase tracking-wide flex items-center justify-center gap-2"
            style={{ background: C.accent, color: C.ink, fontFamily: font.display, fontWeight: 600, opacity: sending ? 0.7 : 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            {sending ? "Redirecting…" : "Sign in with Google"}
          </button>
          {status && <p className="text-xs mt-3" style={{ color: C.mute }}>{status}</p>}
        </div>
      </div>
    );
  }

  return children({ session, signOut });
}
