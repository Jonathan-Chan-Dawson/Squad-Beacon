import { admin, headers, user } from "../_shared/server.ts";
Deno.serve(async (request) => {
  let cors: Record<string, string>;
  try {
    cors = headers(request);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });
  try {
    const account = await user(request),
      db = admin();
    // Delete storage before auth deletion; failures leave the account intact and retryable.
    for (let i = 0; i < 100; i++) {
      const { data, error } = await db.storage
        .from("avatars")
        .list(account.id, { limit: 100, offset: 0 });
      if (error) throw error;
      if (!data?.length) break;
      const removed = await db.storage
        .from("avatars")
        .remove(data.map((f) => account.id + "/" + f.name));
      if (removed.error) throw removed.error;
      if (i === 99)
        throw new Error("Storage cleanup incomplete; retry deletion.");
    }
    const { error } = await db.auth.admin.deleteUser(account.id);
    if (error) throw error;
    return new Response(JSON.stringify({ deleted: true }), { headers: cors });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Deletion failed",
      }),
      { status: 400, headers: cors },
    );
  }
});
