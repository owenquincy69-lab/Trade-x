import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ksh } from "@/lib/referral";

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({
    meta: [
      { title: "Sell on Trade X" },
      { name: "description", content: "List your products on Trade X and get paid to your wallet." },
      { property: "og:title", content: "Sell on Trade X" },
      { property: "og:description", content: "List products and reach buyers across Kenya." },
    ],
  }),
  component: SellPage,
});

const CATS = ["Electronics", "Fashion", "Home", "Beauty", "General"];

function SellPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", price: "", stock: "1", category: "General", image_url: "" });
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["my-products", user.id],
    queryFn: async () => {
      const [p, s] = await Promise.all([
        supabase.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
        supabase.from("orders").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      return { products: p.data ?? [], sales: s.data ?? [] };
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      seller_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      category: form.category,
      image_url: form.image_url.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Product listed!");
    setForm({ title: "", description: "", price: "", stock: "1", category: "General", image_url: "" });
    qc.invalidateQueries();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_1.2fr]">
      <form onSubmit={submit} className="space-y-4 rounded-lg border-2 border-ink bg-card p-6 shadow-pop">
        <h1 className="text-2xl">List a product</h1>
        <div><Label>Title</Label><Input value={form.title} onChange={set("title")} required maxLength={120} /></div>
        <div><Label>Description</Label><Textarea value={form.description} onChange={set("description")} maxLength={2000} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Price (KSh)</Label><Input type="number" min={1} value={form.price} onChange={set("price")} required /></div>
          <div><Label>Stock</Label><Input type="number" min={1} value={form.stock} onChange={set("stock")} required /></div>
        </div>
        <div>
          <Label>Category</Label>
          <select value={form.category} onChange={set("category")} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><Label>Image link</Label><Input type="url" placeholder="https://…" value={form.image_url} onChange={set("image_url")} /></div>
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Listing…" : "List product"}</Button>
      </form>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-xl">My products</h2>
          {(data?.products ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven't listed anything yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border-2 border-ink bg-card">
              {data!.products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {p.image_url && <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover" />}
                  <div className="flex-1">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{ksh(p.price)} · {p.stock} in stock</p>
                  </div>
                  <button onClick={() => remove(p.id)} aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-xl">Recent sales</h2>
          {(data?.sales ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet. Earnings go to your wallet.</p>
          ) : (
            <ul className="divide-y rounded-lg border-2 border-ink bg-card">
              {data!.sales.map((s) => (
                <li key={s.id} className="flex justify-between px-4 py-3 text-sm">
                  <span>{s.product_title} × {s.quantity}</span><b>{ksh(s.total)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
