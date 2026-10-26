import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard, type Product } from "@/components/ProductCard";
import { TIERS, ksh } from "@/lib/referral";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trade X — Shop, sell & earn referral cash in Kenya" },
      { name: "description", content: "Buy and sell anything on Trade X. Pay with M-Pesa and earn up to KSh 4,000 per referral." },
      { property: "og:title", content: "Trade X — Shop, sell & earn" },
      { property: "og:description", content: "Kenya's marketplace where you buy, sell and earn referral commissions." },
    ],
  }),
  component: Home,
});

const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Beauty", "General"];

function Home() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,title,price,image_url,category,stock")
        .gt("stock", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = products.filter(
    (p) => (cat === "All" || p.category === cat) && p.title.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 inline-block rounded bg-primary px-2 py-1 text-xs font-bold uppercase text-primary-foreground">
              Buy · Sell · Earn
            </p>
            <h1 className="text-4xl leading-tight md:text-6xl">
              Shop everything.<br />
              <span className="text-primary">Get paid</span> to share.
            </h1>
            <p className="mt-4 max-w-md text-ink-foreground/75">
              Pay with M-Pesa, sell your own products, and earn up to {ksh(4000)} for every friend you bring.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="hero" size="lg" asChild>
                <a href="#shop">Start shopping</a>
              </Button>
              <Button variant="outline" size="lg" asChild className="border-ink-foreground/30 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
                <Link to="/referrals">Earn with referrals</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["/images/earbuds.jpg", "/images/sneakers.jpg", "/images/watch.jpg", "/images/backpack.jpg"].map((src, i) => (
              <img key={src} src={src} alt="" width={400} height={400} className={`rounded-lg border-2 border-primary object-cover ${i % 2 ? "translate-y-6" : ""}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-ink bg-primary">
        <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 py-4 text-primary-foreground">
          {[...TIERS].reverse().map((t) => (
            <div key={t.min} className="shrink-0">
              <p className="text-xs font-semibold uppercase">Friend spends {ksh(t.min)}</p>
              <p className="font-display text-xl">You earn {ksh(t.commission)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="shop" className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-3xl">Trending now</h2>
          <div className="relative md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-9" />
          </div>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border-2 border-ink px-4 py-1 text-sm font-semibold ${cat === c ? "bg-ink text-ink-foreground" : "bg-card"}`}
            >
              {c}
            </button>
          ))}
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">No products found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
