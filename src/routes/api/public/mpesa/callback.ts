import { createFileRoute } from "@tanstack/react-router";

type StkCallback = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: { Item: { Name: string; Value?: string | number }[] };
    };
  };
};

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t");
        if (!token || token !== process.env["MPESA_CALLBACK_TOKEN"]) {
          return new Response("Forbidden", { status: 403 });
        }
        const body = (await request.json()) as StkCallback;
        const cb = body.Body?.stkCallback;
        if (!cb?.CheckoutRequestID) return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        const receipt = cb.CallbackMetadata?.Item.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.rpc("complete_deposit", {
          _checkout: cb.CheckoutRequestID,
          _receipt: receipt ? String(receipt) : "",
          _ok: cb.ResultCode === 0,
          _desc: cb.ResultDesc,
        });
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
