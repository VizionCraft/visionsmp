export async function onRequestGet(context) {
  const secret = context.env.TEBEX_SECRET;

  if (!secret) {
    return Response.json(
      { error: "Store configuration unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const response = await fetch("https://plugin.tebex.io/information", {
      method: "GET",
      headers: {
        "X-Tebex-Secret": secret,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return Response.json(
        { error: "Store connection unavailable." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = await response.json();
    const account = data?.account || {};

    return Response.json(
      {
        store_url: account.domain || null,
        store_name: account.name || "Vision SMP Store",
        currency: account.currency?.iso_4217 || null
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch {
    return Response.json(
      { error: "Store connection unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}