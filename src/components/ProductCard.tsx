import { Link } from "@tanstack/react-router";
import { ksh } from "@/lib/referral";

export type Product = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  category: string;
  stock: number;
};

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      className="group block overflow-hidden rounded-lg border-2 border-ink bg-card transition-transform hover:-translate-y-1 hover:shadow-pop"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {p.image_url ? (
          <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category}</p>
        <h3 className="line-clamp-1 font-sans text-base font-semibold">{p.title}</h3>
        <p className="font-display text-lg text-primary">{ksh(p.price)}</p>
      </div>
    </Link>
  );
}
