import { admin } from "../_shared/server.ts";
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("WORKER_SECRET");
  if (!secret || request.headers.get("x-worker-secret") !== secret)
    return new Response("Unauthorized", { status: 401 });
  const db = admin();
  async function rpc(name: string, args?: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw error;
    return data;
  }
  try {
    await rpc("beacon_maintenance");
    const jobs = (await rpc("beacon_claim_push")) as {
      id: string;
      token: string;
      body: string;
    }[];
    for (const job of jobs) {
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(Deno.env.get("EXPO_ACCESS_TOKEN")
              ? { Authorization: "Bearer " + Deno.env.get("EXPO_ACCESS_TOKEN") }
              : {}),
          },
          body: JSON.stringify({
            to: job.token,
            title: "Squad Beacon",
            body: job.body,
            sound: "default",
            channelId: "default",
            data: {},
          }),
        });
        if (!response.ok) throw new Error("Push request failed");
        const result = await response.json(),
          ticket = result.data;
        if (!ticket) throw new Error("Missing push ticket");
        await rpc("beacon_finish_push", {
          job_id: job.id,
          ticket: ticket.id ?? null,
          invalid_token: ticket.details?.error === "DeviceNotRegistered",
          retry:
            ticket.status === "error" &&
            ticket.details?.error !== "DeviceNotRegistered",
        });
      } catch {
        await rpc("beacon_finish_push", { job_id: job.id, retry: true });
      }
    }
    const receipts = (await rpc("beacon_claim_receipts")) as {
      id: string;
      ticket_id: string;
    }[];
    if (receipts.length) {
      const response = await fetch(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(Deno.env.get("EXPO_ACCESS_TOKEN")
              ? { Authorization: "Bearer " + Deno.env.get("EXPO_ACCESS_TOKEN") }
              : {}),
          },
          body: JSON.stringify({ ids: receipts.map((r) => r.ticket_id) }),
        },
      );
      if (response.ok) {
        const { data } = await response.json();
        for (const job of receipts) {
          const receipt = data?.[job.ticket_id];
          if (receipt)
            await rpc("beacon_finish_receipt", {
              job_id: job.id,
              invalid_token: receipt.details?.error === "DeviceNotRegistered",
            });
        }
      }
    }
    return Response.json({ processed: jobs.length });
  } catch {
    return Response.json(
      { error: "Worker failed; inspect server logs and retry." },
      { status: 500 },
    );
  }
});
