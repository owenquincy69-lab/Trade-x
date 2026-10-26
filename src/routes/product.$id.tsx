import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";
import { ksh } from "@/lib/referral";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Product — Trade X" },
      { name: "description", content: "View this product on Trade X and pay from your wallet." },
      { property: "og:title", content: "Product on Trade X" },
      { property: "og:description", content: "Shop on Trade X and pay with M-Pesa." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function buy() {
    if (!user) { navigate({ to: "/auth", search: {} }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("purchase_product", { _product: id, _qty: qty });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Order placed! Paid from your wallet.");
    qc.invalidateQueries();
    navigate({ to: "/wallet" });
  }

  if (isLoading) return <p className="p-8 text-muted-foreground">Loading…</p>;
  if (!p) return <p className="p-8">Product not found.</p>;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
      <div className="overflow-hidden rounded-lg border-2 border-ink bg-muted">
        {p.image_url && <img src={p.image_url} alt={p.title} className="aspect-square w-full object-cover" />}
      </div>
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Back to shop</Link>
        <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{p.category}</p>
        <h1 className="mt-1 text-3xl">{p.title}</h1>
        <p className="mt-3 font-display text-3xl text-primary">{ksh(p.price)}</p>
        <p className="mt-4 whitespace-pre-line text-muted-foreground">{p.description}</p>
        <p className="mt-4 text-sm">{p.stock} in stock</p>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center rounded-md border-2 border-ink">
            <button className="p-2" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Less"><Minus className="h-4 w-4" /></button>
            <span className="w-8 text-center font-semibold">{qty}</span>
            <button className="p-2" onClick={() => setQty(Math.min(p.stock, qty + 1))} aria-label="More"><Plus className="h-4 w-4" /></button>
          </div>
          <Button variant="hero" size="lg" onClick={buy} disabled={busy || p.stock < 1 || p.seller_id === user?.id}>
            {busy ? "Processing…" : `Buy for ${ksh(Number(p.price) * qty)}`}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Paid from your Trade X wallet. Top up with M-Pesa on the Wallet page.</p>
      </div>
    </div>
  );
}
