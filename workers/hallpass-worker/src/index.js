const STATE_KEY = "hallpass-state";
const LOG_KEY = "hallpass-log";
const MAX_LOG_ENTRIES = 300;
const LOG_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

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
    return stored || { inUse: false, blocked: false };
  }

  async saveState(nextState) {
    if (!nextState.inUse && !nextState.blocked) {
      await this.state.storage.delete(STATE_KEY);
      return;
    }
    await this.state.storage.put(STATE_KEY, nextState);
  }

  async loadLog() {
    var stored = await this.state.storage.get(LOG_KEY);
    return Array.isArray(stored) ? stored : [];
  }

  pruneLog(entries) {
    var cutoff = Date.now() - LOG_RETENTION_MS;
    var pruned = entries.filter(function (entry) {
      var timestamp = entry.endedAt || entry.startedAt || 0;
      return timestamp >= cutoff;
    });
    if (pruned.length > MAX_LOG_ENTRIES) {
      pruned = pruned.slice(pruned.length - MAX_LOG_ENTRIES);
    }
    return pruned;
  }

  async appendLog(entry) {
    var entries = await this.loadLog();
    entries.push(entry);
    entries = this.pruneLog(entries);
    await this.state.storage.put(LOG_KEY, entries);
    return entries;
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

  buildAdminStatus(state) {
    var payload = this.buildStatus(state, "");
    if (state.inUse) {
      payload.studentId = state.studentId || "";
    }
    return payload;
  }

  buildLogSummary(entries) {
    var counts = {};
    var totalDuration = 0;

    entries.forEach(function (entry) {
      var id = entry.studentId || "";
      if (id) {
        counts[id] = (counts[id] || 0) + 1;
      }
      totalDuration += Number(entry.durationMs) || 0;
    });

    var top = Object.keys(counts)
      .map(function (id) {
        return { studentId: id, count: counts[id] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, 8);

    return {
      total: entries.length,
      averageDurationMs: entries.length ? Math.round(totalDuration / entries.length) : 0,
      topStudents: top
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
    var studentId = payload && payload.studentId ? String(payload.studentId).trim() : "";

    if (action === "status") {
      return jsonResponse(this.buildStatus(state, token));
    }

    if (action === "admin_status") {
      return jsonResponse(this.buildAdminStatus(state));
    }

    if (action === "log") {
      var entries = await this.loadLog();
      entries = this.pruneLog(entries);
      if (entries.length) {
        await this.state.storage.put(LOG_KEY, entries);
      }
      return jsonResponse({
        status: "ok",
        events: entries,
        summary: this.buildLogSummary(entries)
      });
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
      if (!/^[0-9]{4,12}$/.test(studentId)) {
        return jsonResponse({ status: "invalid_student_id" });
      }
      var newToken = crypto.randomUUID();
      var startedAt = Date.now();
      await this.saveState({
        inUse: true,
        startedAt: startedAt,
        token: newToken,
        studentId: studentId,
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
        var endedAt = Date.now();
        await this.appendLog({
          id: crypto.randomUUID(),
          studentId: state.studentId || "",
          startedAt: state.startedAt,
          endedAt: endedAt,
          durationMs: Math.max(0, endedAt - (state.startedAt || endedAt)),
          forced: false
        });
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
      var forcedEndedAt = Date.now();
      await this.appendLog({
        id: crypto.randomUUID(),
        studentId: state.studentId || "",
        startedAt: state.startedAt,
        endedAt: forcedEndedAt,
        durationMs: Math.max(0, forcedEndedAt - (state.startedAt || forcedEndedAt)),
        forced: true
      });
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
        blockedState.studentId = state.studentId || "";
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
        unblockedState.studentId = state.studentId || "";
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
