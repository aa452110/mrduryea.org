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
  if (!context.env || !context.env.HALLPASS) {
    return jsonResponse({
      status: "error",
      message: "Durable Object binding HALLPASS is not configured."
    }, 500);
  }
  var id = context.env.HALLPASS.idFromName("hallpass");
  var stub = context.env.HALLPASS.get(id);
  if (context.request.method === "POST") {
    var payload = null;
    try {
      payload = await context.request.json();
    } catch (error) {
      return jsonResponse({ status: "bad_request" }, 400);
    }
    var action = payload && payload.action ? String(payload.action) : "";
    if (["claim", "status", "release"].indexOf(action) === -1) {
      return jsonResponse({ status: "forbidden" }, 403);
    }
    var forwarded = new Request(context.request.url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return stub.fetch(forwarded);
  }

  return stub.fetch(context.request);
}
