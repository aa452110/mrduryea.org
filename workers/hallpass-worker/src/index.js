const STATE_KEY = "hallpass-state";

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export class HallPassDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async loadState() {
    var stored = await this.state.storage.get(STATE_KEY);
    return stored || { inUse: false };
  }

  async saveState(nextState) {
    await this.state.storage.put(STATE_KEY, nextState);
  }

  async clearState() {
    await this.state.storage.delete(STATE_KEY);
  }

  buildStatus(state, token) {
    if (!state.inUse) {
      return { status: "available" };
    }
    return {
      status: "in_use",
      startedAt: state.startedAt,
      isHolder: token && token === state.token
    };
  }

  async fetch(request) {
    var url = new URL(request.url);
    var tokenFromQuery = url.searchParams.get("token") || "";
    var state = await this.loadState();

    if (request.method === "GET") {
      return jsonResponse(this.buildStatus(state, tokenFromQuery));
    }

    if (request.method !== "POST") {
      return jsonResponse({ status: "method_not_allowed" }, 405);
    }

    var payload = null;
    try {
      payload = await request.json();
    } catch (error) {
      return jsonResponse({ status: "bad_request" }, 400);
    }

    var action = payload && payload.action ? String(payload.action) : "";
    var token = payload && payload.token ? String(payload.token) : "";

    if (action === "status") {
      return jsonResponse(this.buildStatus(state, token));
    }

    if (action === "claim") {
      if (state.inUse) {
        return jsonResponse({
          status: "in_use",
          startedAt: state.startedAt
        });
      }
      var newToken = crypto.randomUUID();
      var startedAt = Date.now();
      await this.saveState({
        inUse: true,
        startedAt: startedAt,
        token: newToken
      });
      return jsonResponse({
        status: "claimed",
        startedAt: startedAt,
        token: newToken
      });
    }

    if (action === "release") {
      if (!state.inUse) {
        return jsonResponse({ status: "available" });
      }
      if (token && token === state.token) {
        await this.clearState();
        return jsonResponse({ status: "released" });
      }
      return jsonResponse({
        status: "denied",
        startedAt: state.startedAt
      });
    }

    if (action === "force_release") {
      if (!state.inUse) {
        return jsonResponse({ status: "available" });
      }
      await this.clearState();
      return jsonResponse({ status: "released", forced: true });
    }

    return jsonResponse({ status: "bad_request" }, 400);
  }
}

export default {
  fetch() {
    return new Response("Hall pass durable object worker.", { status: 200 });
  }
};
