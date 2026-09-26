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

function redirect(url, status = 302) {
  return new Response(null, {
    status,
    headers: {
      "Location": url,
      "Cache-Control": "no-store"
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

async function readTebexError(response) {
  try {
    const data = await response.json();
    return data?.detail || data?.message || data?.error || JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }
}

async function findPackage(base, rank) {
  const response = await tebexFetch(`${base}/categories?includePackages=1`);

  if (!response.ok) {
    const detail = await readTebexError(response);
    throw new Error(`catalog:${response.status}:${detail}`);
  }

  const payload = await response.json();
  const categories = Array.isArray(payload?.data) ? payload.data : [];
  const packages = categories.flatMap(category =>
    Array.isArray(category?.packages) ? category.packages : []
  );

  return packages.find(
    item => String(item?.name || "").trim().toUpperCase() === rank
  ) || null;
}

/*
  POST /api/tebex/checkout
  Starts a Headless API basket and sends the player to Tebex identity auth.

  After successful Minecraft authentication, Tebex returns the player to the
  GET handler below. The GET handler then adds the rank to the authenticated
  basket and redirects directly to Tebex checkout.
*/
export async function onRequestPost(context) {
  const token = context.env.TEBEX_PUBLIC_TOKEN;

  if (!token) {
    return json({
      error: "Tebex is not configured.",
      detail: "Add TEBEX_PUBLIC_TOKEN to this Cloudflare Pages project."
    }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid checkout request." }, 400);
  }

  const rank = String(body?.rank || "").trim().toUpperCase();
  if (!ALLOWED_RANKS.has(rank)) {
    return json({ error: "Unknown rank." }, 400);
  }

  const base = `https://headless.tebex.io/api/accounts/${encodeURIComponent(token)}`;

  try {
    // Confirm the requested rank actually exists before creating a basket.
    const pkg = await findPackage(base, rank);
    if (!pkg?.id) {
      return json({
        error: `${rank} was not found in Tebex.`,
        detail: `Make sure the Tebex package is named exactly "${rank}".`
      }, 404);
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
      const detail = await readTebexError(basketResponse);
      return json({
        error: "Could not create the Tebex basket.",
        detail: `Tebex returned HTTP ${basketResponse.status}${detail ? `: ${detail}` : ""}`
      }, 502);
    }

    const basketPayload = await basketResponse.json();
    const basket = basketPayload?.data || basketPayload;
    const ident = basket?.ident;

    if (!ident) {
      return json({
        error: "Tebex did not return a basket identifier."
      }, 502);
    }

    // Important: authenticate the Minecraft account BEFORE adding the package.
    // Tebex sends the user back to this same Function after auth.
    const callbackUrl =
      `${origin}/api/tebex/checkout?basket=${encodeURIComponent(ident)}&rank=${encodeURIComponent(rank)}`;

    const authResponse = await tebexFetch(
      `${base}/baskets/${encodeURIComponent(ident)}/auth?returnUrl=${encodeURIComponent(callbackUrl)}`
    );

    if (!authResponse.ok) {
      const detail = await readTebexError(authResponse);
      return json({
        error: "Could not start Minecraft account authentication.",
        detail: `Tebex returned HTTP ${authResponse.status}${detail ? `: ${detail}` : ""}`
      }, 502);
    }

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

    const authUrl =
      authLinks.find(link => typeof link?.url === "string" && link.url)?.url || null;

    if (!authUrl) {
      return json({
        error: "Tebex did not return a Minecraft authentication URL."
      }, 502);
    }

    return json({
      redirect_url: authUrl,
      requires_auth: true,
      rank
    });
  } catch (error) {
    const message = String(error?.message || "");
    return json({
      error: "Tebex checkout is temporarily unavailable.",
      detail: message.startsWith("catalog:")
        ? `Could not load the Tebex package catalogue (${message.slice(8)}).`
        : undefined
    }, 502);
  }
}

/*
  GET /api/tebex/checkout?basket=...&rank=...
  Tebex returns here after account authentication.
*/
export async function onRequestGet(context) {
  const token = context.env.TEBEX_PUBLIC_TOKEN;

  if (!token) {
    return json({
      error: "Tebex is not configured.",
      detail: "Add TEBEX_PUBLIC_TOKEN to this Cloudflare Pages project."
    }, 503);
  }

  const requestUrl = new URL(context.request.url);
  const ident = String(requestUrl.searchParams.get("basket") || "").trim();
  const rank = String(requestUrl.searchParams.get("rank") || "").trim().toUpperCase();

  if (!ident || !ALLOWED_RANKS.has(rank)) {
    return json({ error: "Invalid Tebex return request." }, 400);
  }

  const base = `https://headless.tebex.io/api/accounts/${encodeURIComponent(token)}`;

  try {
    // Fetch the basket after Tebex identity authentication.
    const basketResponse = await tebexFetch(
      `${base}/baskets/${encodeURIComponent(ident)}`
    );

    if (!basketResponse.ok) {
      const detail = await readTebexError(basketResponse);
      return json({
        error: "Could not reload the Tebex basket.",
        detail: `Tebex returned HTTP ${basketResponse.status}${detail ? `: ${detail}` : ""}`
      }, 502);
    }

    const basketPayload = await basketResponse.json();
    const basket = basketPayload?.data || basketPayload;

    // Minecraft stores should have a username/user id after identity auth.
    if (!basket?.username && !basket?.username_id) {
      return json({
        error: "Minecraft account authentication was not completed.",
        detail: "Return to the store and try the purchase again."
      }, 400);
    }

    const pkg = await findPackage(base, rank);
    if (!pkg?.id) {
      return json({
        error: `${rank} was not found in Tebex.`,
        detail: `Make sure the Tebex package is named exactly "${rank}".`
      }, 404);
    }

    const addResponse = await tebexFetch(
      `https://headless.tebex.io/api/baskets/${encodeURIComponent(ident)}/packages`,
      {
        method: "POST",
        body: JSON.stringify({
          package_id: String(pkg.id),
          quantity: 1
        })
      }
    );

    if (!addResponse.ok) {
      const detail = await readTebexError(addResponse);
      return json({
        error: `Could not add ${rank} to the Tebex basket.`,
        detail: `Tebex returned HTTP ${addResponse.status}${detail ? `: ${detail}` : ""}`
      }, 502);
    }

    const addPayload = await addResponse.json();
    const updatedBasket = addPayload?.data || addPayload;

    const checkoutUrl =
      updatedBasket?.links?.checkout ||
      basket?.links?.checkout;

    if (!checkoutUrl) {
      return json({
        error: "Tebex did not return a checkout URL."
      }, 502);
    }

    return redirect(checkoutUrl);
  } catch (error) {
    return json({
      error: "Tebex checkout is temporarily unavailable.",
      detail: String(error?.message || "Unknown Tebex error")
    }, 502);
  }
}
