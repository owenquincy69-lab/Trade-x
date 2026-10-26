import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MIN_QUALIFIED_REFERRALS, TIERS, ksh } from "@/lib/referral";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — Trade X" },
      { name: "description", content: "Invite friends to Trade X and earn commissions in KSh." },
      { property: "og:title", content: "Earn with Trade X referrals" },
      { property: "og:description", content: "Refer 3 friends and earn from KSh 100 up to KSh 4,000 each." },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { user } = Route.useRouteContext();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const { data } = useQuery({
    queryKey: ["referrals", user.id],
    queryFn: async () => {
      const [me, friends, comms] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("id,display_name,created_at").eq("referred_by", user.id),
        supabase.from("referral_commissions").select("*").eq("referrer_id", user.id),
      ]);
      return { code: me.data?.referral_code ?? "", friends: friends.data ?? [], comms: comms.data ?? [] };
    },
  });

  const link = data?.code ? `${origin}/auth?ref=${data.code}` : "";
  const qualified = (data?.comms ?? []).filter((c) => Number(c.commission) > 0).length;
  const earned = (data?.comms ?? []).reduce((s, c) => s + Number(c.paid_out), 0);
  const pending = (data?.comms ?? []).reduce((s, c) => s + Number(c.commission) - Number(c.paid_out), 0);
  const unlocked = qualified >= MIN_QUALIFIED_REFERRALS;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div className="rounded-lg bg-ink p-6 text-ink-foreground shadow-pop">
        <h1 className="text-3xl">Invite friends. <span className="text-primary">Get paid.</span></h1>
        <p className="mt-2 text-ink-foreground/75">
          Earn when {MIN_QUALIFIED_REFERRALS}+ friends each deposit or shop at least {ksh(250)}. The more they spend, the higher your tier.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 truncate rounded bg-ink-foreground/10 px-3 py-2 text-sm">{link || "Loading…"}</code>
          <Button variant="hero" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }} disabled={!link}>
            <Copy /> Copy link
          </Button>
        </div>
        <p className="mt-2 text-sm text-ink-foreground/60">Your code: <b className="text-primary">{data?.code}</b></p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Friends joined" value={String(data?.friends.length ?? 0)} />
        <Stat label="Commission paid" value={ksh(earned)} />
        <Stat label={unlocked ? "Pending" : "Locked until 3 qualify"} value={ksh(pending)} />
      </div>

      <div className="rounded-lg border-2 border-ink bg-card p-6">
        <div className="flex justify-between text-sm font-semibold">
          <span>Qualified friends</span>
          <span>{Math.min(qualified, MIN_QUALIFIED_REFERRALS)} / {MIN_QUALIFIED_REFERRALS}</span>
        </div>
        <Progress className="mt-2" value={(Math.min(qualified, MIN_QUALIFIED_REFERRALS) / MIN_QUALIFIED_REFERRALS) * 100} />
        <p className="mt-2 text-xs text-muted-foreground">
          {unlocked ? "Unlocked! Commissions go straight to your wallet." : "Once 3 friends qualify, all your commissions are paid to your wallet."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl">Commission tiers</h2>
          <ul className="overflow-hidden rounded-lg border-2 border-ink bg-card">
            {[...TIERS].reverse().map((t) => (
              <li key={t.min} className="flex justify-between border-b px-4 py-3 text-sm last:border-0">
                <span>Friend deposits / spends {ksh(t.min)}+</span>
                <b className="text-primary">{ksh(t.commission)}</b>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-xl">Your friends</h2>
          {(data?.friends ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet — share your link!</p>
          ) : (
            <ul className="divide-y rounded-lg border-2 border-ink bg-card">
              {data!.friends.map((f) => {
                const c = data!.comms.find((x) => x.referred_id === f.id);
                return (
                  <li key={f.id} className="flex justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{f.display_name ?? "Friend"}</p>
                      <p className="text-xs text-muted-foreground">Spent {ksh(c?.qualifying_amount ?? 0)}</p>
                    </div>
                    <b>{ksh(c?.commission ?? 0)}</b>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border-2 border-ink bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
