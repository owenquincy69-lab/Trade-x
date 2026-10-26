import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Wallet, Users, Store, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export function SiteHeader() {
  const { user, ready } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  }

  return (
    <header className="sticky top-0 z-30 bg-ink text-ink-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary font-display text-lg text-primary-foreground">
            X
          </span>
          <span className="font-display text-xl">TRADE X</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="hidden items-center gap-1 rounded px-3 py-2 hover:text-primary sm:flex">
            <ShoppingBag className="h-4 w-4" /> Shop
          </Link>
          {ready && user ? (
            <>
              <Link to="/wallet" className="flex items-center gap-1 rounded px-3 py-2 hover:text-primary">
                <Wallet className="h-4 w-4" /> <span className="hidden sm:inline">Wallet</span>
              </Link>
              <Link to="/referrals" className="flex items-center gap-1 rounded px-3 py-2 hover:text-primary">
                <Users className="h-4 w-4" /> <span className="hidden sm:inline">Referrals</span>
              </Link>
              <Link to="/sell" className="flex items-center gap-1 rounded px-3 py-2 hover:text-primary">
                <Store className="h-4 w-4" /> <span className="hidden sm:inline">Sell</span>
              </Link>
              <button onClick={signOut} className="flex items-center gap-1 rounded px-3 py-2 hover:text-primary" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth" search={{}}>Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
