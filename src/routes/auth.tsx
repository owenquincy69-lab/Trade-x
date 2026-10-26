import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { ref?: string | undefined } => ({ ref: typeof s["ref"] === "string" ? s["ref"] : undefined }),
  head: () => ({
    meta: [
      { title: "Sign in — Trade X" },
      { name: "description", content: "Sign in or create your Trade X account." },
      { property: "og:title", content: "Join Trade X" },
      { property: "og:description", content: "Create an account to shop, sell and earn referral commissions." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">(ref ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/wallet" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { display_name: name, ref: ref ?? undefined } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/wallet" });
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed");
  }

  if (sent)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-3xl">Check your email</h1>
        <p className="mt-3 text-muted-foreground">We sent a confirmation link to {email}. Click it to activate your account.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-lg border-2 border-ink bg-card p-6 shadow-pop">
        <h1 className="text-3xl">{mode === "up" ? "Join Trade X" : "Welcome back"}</h1>
        {ref && mode === "up" && (
          <p className="mt-2 rounded bg-accent px-3 py-2 text-sm">You were invited with code <b>{ref}</b>.</p>
        )}
        {!ref && (
          <Button variant="outline" className="mt-6 w-full" onClick={google}>
            Continue with Google
          </Button>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "up" && (
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <button className="mt-4 w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setMode(mode === "up" ? "in" : "up")}>
          {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
