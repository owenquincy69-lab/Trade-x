import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startMpesaDeposit } from "@/lib/mpesa.functions";
import { ksh } from "@/lib/referral";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "My wallet — Trade X" },
      { name: "description", content: "Your Trade X balance, M-Pesa deposits and orders." },
      { property: "og:title", content: "My wallet — Trade X" },
      { property: "og:description", content: "Top up with M-Pesa and track your orders." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const deposit = useServerFn(startMpesaDeposit);
  const [amount, setAmount] = useState("250");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["wallet", user.id],
    refetchInterval: 8000,
    queryFn: async () => {
      const [w, tx, orders, deps] = await Promise.all([
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("deposits").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      ]);
      return { balance: Number(w.data?.balance ?? 0), tx: tx.data ?? [], orders: orders.data ?? [], pending: deps.data ?? [] };
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await deposit({ data: { amount: Number(amount), phone } });
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-ink p-6 text-ink-foreground shadow-pop">
          <p className="text-sm uppercase tracking-wide text-ink-foreground/70">Wallet balance</p>
          <p className="mt-2 font-display text-5xl text-primary">{ksh(data?.balance ?? 0)}</p>
          {data && data.pending.length > 0 && (
            <p className="mt-4 text-sm text-ink-foreground/70">
              {data.pending.length} M-Pesa payment(s) waiting for confirmation…
            </p>
          )}
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg border-2 border-ink bg-card p-6">
          <h2 className="flex items-center gap-2 text-xl"><Smartphone className="h-5 w-5 text-primary" /> Deposit with M-Pesa</h2>
          <div>
            <Label htmlFor="phone">M-Pesa phone number</Label>
            <Input id="phone" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="amt">Amount (KSh)</Label>
            <Input id="amt" type="number" min={10} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? "Sending prompt…" : "Send M-Pesa prompt"}
          </Button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl">My orders</h2>
          <List empty="No orders yet." items={(data?.orders ?? []).map((o) => ({ id: o.id, left: `${o.product_title} × ${o.quantity}`, right: ksh(o.total), date: o.created_at }))} />
        </section>
        <section>
          <h2 className="mb-3 text-xl">Activity</h2>
          <List
            empty="No activity yet."
            items={(data?.tx ?? []).map((t) => ({
              id: t.id,
              left: `${t.kind.charAt(0).toUpperCase() + t.kind.slice(1)}${t.note ? ` · ${t.note}` : ""}`,
              right: `${Number(t.amount) > 0 ? "+" : ""}${ksh(t.amount)}`,
              date: t.created_at,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

function List({ items, empty }: { items: { id: string; left: string; right: string; date: string }[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y rounded-lg border-2 border-ink bg-card">
      {items.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div>
            <p className="font-medium">{i.left}</p>
            <p className="text-xs text-muted-foreground">{new Date(i.date).toLocaleString("en-KE")}</p>
          </div>
          <span className="font-semibold">{i.right}</span>
        </li>
      ))}
    </ul>
  );
}
