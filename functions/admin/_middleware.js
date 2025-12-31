function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="Hall Pass Admin"',
      "cache-control": "no-store"
    }
  });
}

export async function onRequest(context) {
  var user = context.env && context.env.ADMIN_USER;
  var pass = context.env && context.env.ADMIN_PASS;
  if (!user || !pass) {
    return new Response("Admin credentials are not configured.", {
      status: 500,
      headers: {
        "cache-control": "no-store"
      }
    });
  }

  var auth = context.request.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) {
    return unauthorized();
  }

  var decoded = "";
  try {
    decoded = atob(auth.slice(6));
  } catch (error) {
    return unauthorized();
  }

  var parts = decoded.split(":");
  if (parts.length < 2) {
    return unauthorized();
  }

  var incomingUser = parts.shift();
  var incomingPass = parts.join(":");
  if (incomingUser !== user || incomingPass !== pass) {
    return unauthorized();
  }

  return context.next();
}
