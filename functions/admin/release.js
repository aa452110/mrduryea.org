function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return jsonResponse({ status: "method_not_allowed" }, 405);
  }

  if (!context.env || !context.env.HALLPASS) {
    return jsonResponse({
      status: "error",
      message: "Durable Object binding HALLPASS is not configured."
    }, 500);
  }

  var id = context.env.HALLPASS.idFromName("hallpass");
  var stub = context.env.HALLPASS.get(id);
  var forwarded = new Request(context.request.url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ action: "force_release" })
  });
  return stub.fetch(forwarded);
}
