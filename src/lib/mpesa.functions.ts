import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return "254" + d;
  return null;
}

export const startMpesaDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; phone: string }) => input)
  .handler(async ({ data, context }) => {
    const amount = Math.floor(Number(data.amount));
    if (!Number.isFinite(amount) || amount < 10 || amount > 150000) throw new Error("Enter an amount between 10 and 150,000");
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, e.g. 0712345678");

    const key = process.env["MPESA_CONSUMER_KEY"];
    const secret = process.env["MPESA_CONSUMER_SECRET"];
    const shortcode = process.env["MPESA_SHORTCODE"];
    const passkey = process.env["MPESA_PASSKEY"];
    const cbToken = process.env["MPESA_CALLBACK_TOKEN"];
    if (!key || !secret || !shortcode || !passkey || !cbToken) throw new Error("M-Pesa is not set up yet. Please try again later.");
    const base = process.env["MPESA_ENV"] === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

    const tokenRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}` },
    });
    if (!tokenRes.ok) throw new Error("Could not reach M-Pesa. Try again.");
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const now = new Date(Date.now() + 3 * 3600 * 1000); // Nairobi time
    const ts = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${ts}`);
    const origin = new URL(getRequest().url).origin;

    const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: `${origin}/api/public/mpesa/callback?t=${encodeURIComponent(cbToken)}`,
        AccountReference: "TradeX",
        TransactionDesc: "Trade X wallet deposit",
      }),
    });
    const stk = (await stkRes.json()) as { ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string; CustomerMessage?: string };
    if (stk.ResponseCode !== "0" || !stk.CheckoutRequestID) throw new Error(stk.errorMessage ?? "M-Pesa request failed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("deposits").insert({
      user_id: context.userId,
      amount,
      phone,
      checkout_request_id: stk.CheckoutRequestID,
    });
    if (error) throw new Error("Could not record deposit");
    return { message: stk.CustomerMessage ?? "Check your phone and enter your M-Pesa PIN." };
  });
