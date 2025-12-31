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
  return stub.fetch(context.request);
}
