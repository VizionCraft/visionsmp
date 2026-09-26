const ALLOWED_RANKS = new Set(["VIP", "ELITE", "LEGEND"]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function tebexFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
}

export async function onRequestPost(context) {
  const token = context.env.TEBEX_PUBLIC_TOKEN;
  if (!token) {
    return json({ error: "Tebex checkout is not configured yet." }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const rank = String(body?.rank || "").trim().toUpperCase();
  if (!ALLOWED_RANKS.has(rank)) {
    return json({ error: "Unknown rank." }, 400);
  }

  const base = `https://headless.tebex.io/api/accounts/${encodeURIComponent(token)}`;

  try {
    // Pull the live Tebex catalogue so package IDs/prices do not need to be
    // duplicated in the website configuration.
    const categoriesResponse = await tebexFetch(`${base}/categories?includePackages=1`);
    if (!categoriesResponse.ok) {
      return json({ error: "Could not load the Tebex catalogue." }, 502);
    }

    const categoriesPayload = await categoriesResponse.json();
    const categories = Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : [];
    const packages = categories.flatMap(category => Array.isArray(category?.packages) ? category.packages : []);

    const pkg = packages.find(item => String(item?.name || "").trim().toUpperCase() === rank);
    if (!pkg?.id) {
      return json({ error: `${rank} was not found in the Tebex store.` }, 404);
    }

    const requestUrl = new URL(context.request.url);
    const origin = requestUrl.origin;

    const basketResponse = await tebexFetch(`${base}/baskets`, {
      method: "POST",
      body: JSON.stringify({
        complete_url: `${origin}/store.html?purchase=success`,
        cancel_url: `${origin}/store.html?purchase=cancelled`,
        complete_auto_redirect: true,
        custom: {
          source: "visionsmp.com",
          rank
        }
      })
    });

    if (!basketResponse.ok) {
      return json({ error: "Could not start Tebex checkout." }, 502);
    }

    const basketPayload = await basketResponse.json();
    const basket = basketPayload?.data || basketPayload;
    const ident = basket?.ident;

    if (!ident) {
      return json({ error: "Tebex did not return a checkout basket." }, 502);
    }

    const addResponse = await tebexFetch(`https://headless.tebex.io/api/baskets/${encodeURIComponent(ident)}/packages`, {
      method: "POST",
      body: JSON.stringify({
        package_id: String(pkg.id),
        quantity: 1
      })
    });

    if (!addResponse.ok) {
      return json({ error: `Could not add ${rank} to checkout.` }, 502);
    }

    const addPayload = await addResponse.json();
    const updatedBasket = addPayload?.data || addPayload;
    const checkoutUrl = updatedBasket?.links?.checkout || basket?.links?.checkout || `https://pay.tebex.io/${ident}`;

    // Minecraft webstores require the buyer to authenticate their game account
    // before checkout. Tebex returns the correct identity-provider URL for the
    // basket; after authentication it sends the buyer straight to checkout.
    const authResponse = await tebexFetch(
      `${base}/baskets/${encodeURIComponent(ident)}/auth?returnUrl=${encodeURIComponent(checkoutUrl)}`
    );

    let authUrl = null;
    if (authResponse.ok) {
      const authPayload = await authResponse.json();
      const authLinks = Array.isArray(authPayload)
        ? authPayload
        : Array.isArray(authPayload?.data)
          ? authPayload.data
          : authPayload?.url
            ? [authPayload]
            : authPayload?.data?.url
              ? [authPayload.data]
              : [];

      authUrl = authLinks.find(link => typeof link?.url === "string" && link.url)?.url || null;
    }

    return json({
      redirect_url: authUrl || checkoutUrl,
      auth_url: authUrl,
      checkout_url: checkoutUrl,
      requires_auth: Boolean(authUrl),
      rank,
      package_id: pkg.id,
      price: pkg.total_price ?? pkg.base_price ?? null,
      currency: pkg.currency ?? null
    });
  } catch {
    return json({ error: "Tebex checkout is temporarily unavailable." }, 502);
  }
}
