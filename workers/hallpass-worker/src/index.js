const STATE_KEY = "hallpass-state";
const MIGRATION_KEY = "hallpass-migration-no-student-id";

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

  async migrateIfNeeded() {
    var migrated = await this.state.storage.get(MIGRATION_KEY);
    if (migrated) {
      return;
    }

    await this.state.storage.delete("hallpass-log");

    var storedState = await this.state.storage.get(STATE_KEY);
    if (storedState && typeof storedState === "object" && storedState.studentId) {
      var nextState = Object.assign({}, storedState);
      delete nextState.studentId;
      await this.state.storage.put(STATE_KEY, nextState);
    }

    await this.state.storage.put(MIGRATION_KEY, true);
  }

  async loadState() {
    var stored = await this.state.storage.get(STATE_KEY);
    return stored || { inUse: false, blocked: false };
  }

  async saveState(nextState) {
    if (!nextState.inUse && !nextState.blocked) {
      await this.state.storage.delete(STATE_KEY);
      return;
    }
    await this.state.storage.put(STATE_KEY, nextState);
  }

  buildStatus(state, token) {
    if (state.inUse) {
      return {
        status: "in_use",
        startedAt: state.startedAt,
        isHolder: token && token === state.token,
        blocked: !!state.blocked
      };
    }
    if (state.blocked) {
      return {
        status: "blocked",
        blocked: true
      };
    }
    return {
      status: "available",
      blocked: false
    };
  }

  async fetch(request) {
    await this.migrateIfNeeded();

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

    if (action === "admin_status") {
      return jsonResponse(this.buildStatus(state, ""));
    }

    if (action === "claim") {
      if (state.blocked) {
        return jsonResponse({ status: "blocked", blocked: true });
      }
      if (state.inUse) {
        return jsonResponse({
          status: "in_use",
          startedAt: state.startedAt,
          blocked: !!state.blocked
        });
      }
      var newToken = crypto.randomUUID();
      var startedAt = Date.now();
      await this.saveState({
        inUse: true,
        startedAt: startedAt,
        token: newToken,
        blocked: false
      });
      return jsonResponse({
        status: "claimed",
        startedAt: startedAt,
        token: newToken,
        blocked: false
      });
    }

    if (action === "release") {
      if (!state.inUse) {
        return jsonResponse(this.buildStatus(state, token));
      }
      if (token && token === state.token) {
        var releasedState = {
          inUse: false,
          blocked: !!state.blocked
        };
        await this.saveState(releasedState);
        return jsonResponse({ status: "released", blocked: releasedState.blocked });
      }
      return jsonResponse({
        status: "denied",
        startedAt: state.startedAt,
        blocked: !!state.blocked
      });
    }

    if (action === "force_release") {
      if (!state.inUse) {
        return jsonResponse(this.buildStatus(state, token));
      }
      var forcedState = {
        inUse: false,
        blocked: !!state.blocked
      };
      await this.saveState(forcedState);
      return jsonResponse({ status: "released", forced: true, blocked: forcedState.blocked });
    }

    if (action === "block") {
      var blockedState = {
        inUse: !!state.inUse,
        blocked: true
      };
      if (state.inUse) {
        blockedState.token = state.token;
        blockedState.startedAt = state.startedAt;
      }
      await this.saveState(blockedState);
      return jsonResponse({
        status: blockedState.inUse ? "in_use" : "blocked",
        startedAt: blockedState.startedAt,
        blocked: true
      });
    }

    if (action === "unblock") {
      var unblockedState = {
        inUse: !!state.inUse,
        blocked: false
      };
      if (state.inUse) {
        unblockedState.token = state.token;
        unblockedState.startedAt = state.startedAt;
      }
      await this.saveState(unblockedState);
      return jsonResponse(this.buildStatus(unblockedState, token));
    }

    return jsonResponse({ status: "bad_request" }, 400);
  }
}

export default {
  fetch() {
    return new Response("Hall pass durable object worker.", { status: 200 });
  }
};
