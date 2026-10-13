const { expect } = require("chai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Supabase is stubbed on the shared service object, so no network or real keys
// are involved. The routes call supabaseService.<method> at request time, which
// is what makes replacing the methods here effective.
const app = require("../api-server/server");
const { JWT_SECRET } = require("../api-server/middleware/auth");
const supabaseService = require("../api-server/services/supabaseService");
const cacheService = require("../api-server/services/cacheService");

describe("API routes", function () {
  let server, base;
  const original = {};

  const tokenFor = (role, opts = {}) =>
    jwt.sign({ id: 1, role, email: `${role}@x.io` }, JWT_SECRET, { expiresIn: "1h", ...opts });
  const roleAuth = (role) => ({ Authorization: `Bearer ${tokenFor(role)}` });
  const asAdmin = () => roleAuth("admin");

  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  };

  before(async function () {
    Object.assign(original, supabaseService);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async function () {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async function () {
    // Each test gets a fresh rate-limit budget; the limiter is tested on its own below.
    await cacheService.flushPattern("ratelimit:*");
    Object.assign(supabaseService, original);
    supabaseService.isConfigured = () => true;
  });

  afterEach(function () {
    Object.assign(supabaseService, original);
  });

  describe("health and root", function () {
    it("reports ok when Supabase is configured", async function () {
      const r = await call("GET", "/api/health");
      expect(r.status).to.equal(200);
      expect(r.body.status).to.equal("ok");
    });

    it("reports degraded with 503 when Supabase is not configured", async function () {
      supabaseService.isConfigured = () => false;
      const r = await call("GET", "/api/health");
      expect(r.status).to.equal(503);
      expect(r.body.status).to.equal("degraded");
    });

    it("sets security headers", async function () {
      const r = await call("GET", "/api/health");
      expect(r.headers.get("x-content-type-options")).to.equal("nosniff");
      expect(r.headers.get("x-frame-options")).to.equal("DENY");
    });

    it("serves the root text", async function () {
      const r = await call("GET", "/");
      expect(r.status).to.equal(200);
    });
  });

  describe("requireSupabase guard", function () {
    it("returns 503 on database routes when unconfigured", async function () {
      supabaseService.isConfigured = () => false;
      for (const [method, path] of [
        ["GET", "/api/applications"],
        ["GET", "/api/disputes"],
        ["POST", "/api/auth/login"],
      ]) {
        const r = await call(method, path, method === "GET" ? undefined : {});
        expect(r.status, `${method} ${path}`).to.equal(503);
        expect(r.body.error).to.equal("Database not configured");
      }
    });

    it("does not guard the leaderboard, which needs no database", async function () {
      supabaseService.isConfigured = () => false;
      const r = await call("GET", "/api/leaderboard");
      expect(r.status).to.equal(200);
    });
  });

  describe("auth", function () {
    it("signup requires name, email and password", async function () {
      const r = await call("POST", "/api/auth/signup", { email: "a@b.c" });
      expect(r.status).to.equal(400);
    });

    it("signup rejects a duplicate email", async function () {
      supabaseService.findUserByEmail = async () => ({ id: 1 });
      const r = await call("POST", "/api/auth/signup", { name: "A", email: "a@b.c", password: "pw" });
      expect(r.status).to.equal(400);
      expect(r.body.error).to.match(/already exists/);
    });

    it("signup hashes the password, defaults the role and returns a verifiable token", async function () {
      let saved;
      supabaseService.findUserByEmail = async () => null;
      supabaseService.createUser = async (data) => {
        saved = data;
        return { id: 7, name: data.name, email: data.email, role: data.role, bio: data.bio, wallet_address: data.walletAddress };
      };
      const r = await call("POST", "/api/auth/signup", { name: "Ada", email: "ada@x.io", password: "s3cret" });
      expect(r.status).to.equal(201);
      expect(saved.role).to.equal("participant");
      expect(saved.passwordHash).to.not.equal("s3cret");
      expect(await bcrypt.compare("s3cret", saved.passwordHash)).to.equal(true);
      expect(r.body.user).to.deep.include({ id: 7, email: "ada@x.io", role: "participant" });
      expect(r.body.user).to.not.have.property("password_hash");
      const claims = jwt.decode(r.body.token);
      expect(claims).to.include({ id: 7, role: "participant", email: "ada@x.io" });
      expect(claims.exp - claims.iat).to.equal(7 * 24 * 3600);
    });

    it("signup refuses to create an admin and never touches the database", async function () {
      let touched = false;
      supabaseService.findUserByEmail = async () => { touched = true; return null; };
      supabaseService.createUser = async () => { touched = true; return {}; };
      const r = await call("POST", "/api/auth/signup", { name: "Eve", email: "eve@x.io", password: "pw", role: "admin" });
      expect(r.status).to.equal(403);
      expect(touched).to.equal(false);
    });

    it("signup rejects unknown roles", async function () {
      const r = await call("POST", "/api/auth/signup", { name: "E", email: "e@x.io", password: "pw", role: "superuser" });
      expect(r.status).to.equal(403);
    });

    it("signup still allows the judge role", async function () {
      let saved;
      supabaseService.findUserByEmail = async () => null;
      supabaseService.createUser = async (d) => { saved = d; return { id: 2, role: d.role }; };
      const r = await call("POST", "/api/auth/signup", { name: "J", email: "j@x.io", password: "pw", role: "judge" });
      expect(r.status).to.equal(201);
      expect(saved.role).to.equal("judge");
    });

    it("signup returns 500 when the database call fails", async function () {
      supabaseService.findUserByEmail = async () => { throw new Error("db down"); };
      const r = await call("POST", "/api/auth/signup", { name: "A", email: "a@b.c", password: "pw" });
      expect(r.status).to.equal(500);
      expect(r.body.error).to.equal("db down");
    });

    it("login requires email and password", async function () {
      const r = await call("POST", "/api/auth/login", { email: "a@b.c" });
      expect(r.status).to.equal(400);
    });

    it("login gives the same 401 for unknown email and wrong password", async function () {
      supabaseService.findUserByEmail = async () => null;
      const unknown = await call("POST", "/api/auth/login", { email: "no@x.io", password: "pw" });

      const hash = await bcrypt.hash("right", 4);
      supabaseService.findUserByEmail = async () => ({ id: 1, role: "judge", email: "j@x.io", password_hash: hash });
      const wrong = await call("POST", "/api/auth/login", { email: "j@x.io", password: "wrong" });

      expect(unknown.status).to.equal(401);
      expect(wrong.status).to.equal(401);
      expect(wrong.body.error).to.equal(unknown.body.error);
    });

    it("login succeeds with the right password", async function () {
      const hash = await bcrypt.hash("right", 4);
      supabaseService.findUserByEmail = async () => ({
        id: 3, name: "Jo", email: "j@x.io", role: "judge", bio: "", wallet_address: "0xabc", password_hash: hash,
      });
      const r = await call("POST", "/api/auth/login", { email: "j@x.io", password: "right" });
      expect(r.status).to.equal(200);
      expect(r.body.user.walletAddress).to.equal("0xabc");
      expect(jwt.decode(r.body.token).role).to.equal("judge");
    });

    describe("profile update", function () {
      const userAuth = (role = "participant", email = "me@x.io") => ({
        Authorization: `Bearer ${jwt.sign({ id: 1, role, email }, JWT_SECRET, { expiresIn: "1h" })}`,
      });

      it("401 without a token, and never touches the database", async function () {
        let called = false;
        supabaseService.updateUserByEmail = async () => { called = true; return {}; };
        const r = await call("PUT", "/api/auth/profile", { email: "victim@x.io", name: "X" });
        expect(r.status).to.equal(401);
        expect(called).to.equal(false);
      });

      it("401 for a forged token", async function () {
        const forged = jwt.sign({ id: 1, role: "admin", email: "a@x.io" }, "wrong");
        const r = await call("PUT", "/api/auth/profile", { name: "X" }, { Authorization: `Bearer ${forged}` });
        expect(r.status).to.equal(401);
      });

      it("edits the token's own account and ignores an email in the body", async function () {
        let target;
        supabaseService.updateUserByEmail = async (email) => {
          target = email;
          return { id: 1, name: "N", email, role: "participant", bio: "", wallet_address: "" };
        };
        const r = await call("PUT", "/api/auth/profile", { email: "victim@x.io", name: "N" }, userAuth("participant", "me@x.io"));
        expect(r.status).to.equal(200);
        expect(target).to.equal("me@x.io");
      });

      it("works for every role", async function () {
        supabaseService.updateUserByEmail = async (email) => ({ id: 1, email, role: "x" });
        for (const role of ["participant", "judge", "admin"]) {
          const r = await call("PUT", "/api/auth/profile", { name: "N" }, userAuth(role));
          expect(r.status, role).to.equal(200);
        }
      });

      it("returns 404 when the account no longer exists", async function () {
        supabaseService.updateUserByEmail = async () => null;
        const r = await call("PUT", "/api/auth/profile", { name: "X" }, userAuth());
        expect(r.status).to.equal(404);
      });

      it("only sends the fields that were provided", async function () {
        let updates;
        supabaseService.updateUserByEmail = async (email, u) => {
          updates = u;
          return { id: 1, name: "N", email, role: "participant", bio: "", wallet_address: "0x1" };
        };
        const r = await call("PUT", "/api/auth/profile", { bio: "", walletAddress: "0x1" }, userAuth());
        expect(r.status).to.equal(200);
        expect(updates).to.deep.equal({ bio: "", wallet_address: "0x1" });
      });
    });
  });

  describe("status route authorization", function () {
    const routes = [
      ["/api/applications/1/status", "updateApplicationStatus", { status: "Approved" }],
      ["/api/disputes/1/status", "updateDisputeStatus", { status: "Resolved" }],
    ];

    for (const [path, method, body] of routes) {
      describe(`PUT ${path}`, function () {
        let called;
        beforeEach(function () {
          called = false;
          supabaseService[method] = async () => { called = true; return { id: 1 }; };
        });

        it("401 without a token", async function () {
          const r = await call("PUT", path, body);
          expect(r.status).to.equal(401);
          expect(called).to.equal(false);
        });

        it("401 for a malformed Authorization header", async function () {
          const r = await call("PUT", path, body, { Authorization: tokenFor("admin") });
          expect(r.status).to.equal(401);
        });

        it("401 for a token signed with another secret", async function () {
          const forged = jwt.sign({ id: 1, role: "admin" }, "not-the-secret");
          const r = await call("PUT", path, body, { Authorization: `Bearer ${forged}` });
          expect(r.status).to.equal(401);
          expect(called).to.equal(false);
        });

        it("401 for an expired token", async function () {
          const expired = tokenFor("admin", { expiresIn: -10 });
          const r = await call("PUT", path, body, { Authorization: `Bearer ${expired}` });
          expect(r.status).to.equal(401);
        });

        it("401 for an unsigned (alg none) token", async function () {
          const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
          const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: 1, role: "admin" })}.`;
          const r = await call("PUT", path, body, { Authorization: `Bearer ${none}` });
          expect(r.status).to.equal(401);
          expect(called).to.equal(false);
        });

        for (const role of ["participant", "judge"]) {
          it(`403 for a ${role}`, async function () {
            const r = await call("PUT", path, body, { Authorization: `Bearer ${tokenFor(role)}` });
            expect(r.status).to.equal(403);
            expect(called).to.equal(false);
          });
        }

        it("allows an admin", async function () {
          const r = await call("PUT", path, body, asAdmin());
          expect(r.status).to.equal(200);
          expect(called).to.equal(true);
        });
      });
    }

    it("leaves the public routes open", async function () {
      supabaseService.getApplications = async () => [];
      supabaseService.createDispute = async (d) => d;
      expect((await call("GET", "/api/applications")).status).to.equal(200);
      expect((await call("POST", "/api/disputes", { projectId: 1, raisedBy: "0x1", reason: "r" })).status).to.equal(201);
    });
  });

  describe("applications", function () {
    it("lists applications", async function () {
      supabaseService.getApplications = async () => [{ id: 1 }];
      const r = await call("GET", "/api/applications");
      expect(r.status).to.equal(200);
      expect(r.body).to.deep.equal([{ id: 1 }]);
    });

    it("rejects a submission missing required fields", async function () {
      const r = await call("POST", "/api/applications", { name: "P", teamLead: "L" });
      expect(r.status).to.equal(400);
    });

    it("creates an application as Pending with no registered project", async function () {
      let data;
      supabaseService.createApplication = async (d) => { data = d; return { id: 2, ...d }; };
      const r = await call("POST", "/api/applications", {
        name: "P", teamLead: "L", applicantWallet: "0xabc", status: "Approved", registeredProjectId: 99,
      });
      expect(r.status).to.equal(201);
      expect(data.status).to.equal("Pending");
      expect(data.registeredProjectId).to.equal(0);
    });

    it("rejects an invalid status", async function () {
      const r = await call("PUT", "/api/applications/1/status", { status: "Maybe" }, asAdmin());
      expect(r.status).to.equal(400);
    });

    it("returns 404 for an unknown application", async function () {
      supabaseService.updateApplicationStatus = async () => null;
      const r = await call("PUT", "/api/applications/404/status", { status: "Approved" }, asAdmin());
      expect(r.status).to.equal(404);
    });

    it("approves an application and records the project id", async function () {
      let args;
      supabaseService.updateApplicationStatus = async (id, u) => { args = [id, u]; return { id: 5 }; };
      const r = await call("PUT", "/api/applications/5/status", { status: "Approved", registeredProjectId: 12 }, asAdmin());
      expect(r.status).to.equal(200);
      expect(args).to.deep.equal(["5", { status: "Approved", registered_project_id: 12 }]);
    });
  });

  describe("disputes", function () {
    it("lists disputes", async function () {
      supabaseService.getDisputes = async () => [{ id: 1 }];
      const r = await call("GET", "/api/disputes");
      expect(r.status).to.equal(200);
      expect(r.body).to.deep.equal([{ id: 1 }]);
    });

    it("rejects a dispute missing a reason", async function () {
      const r = await call("POST", "/api/disputes", { projectId: 1, raisedBy: "0x1" });
      expect(r.status).to.equal(400);
    });

    it("files a dispute as Pending with a numeric project id", async function () {
      let data;
      supabaseService.createDispute = async (d) => { data = d; return { id: 1, ...d }; };
      const r = await call("POST", "/api/disputes", { projectId: "3", raisedBy: "0x1", reason: "unfair", status: "Resolved" });
      expect(r.status).to.equal(201);
      expect(data).to.deep.equal({ projectId: 3, raisedBy: "0x1", reason: "unfair", status: "Pending" });
    });

    it("rejects an invalid status", async function () {
      const r = await call("PUT", "/api/disputes/1/status", { status: "Approved" }, asAdmin());
      expect(r.status).to.equal(400);
    });

    it("returns 404 for an unknown dispute", async function () {
      supabaseService.updateDisputeStatus = async () => null;
      const r = await call("PUT", "/api/disputes/404/status", { status: "Resolved" }, asAdmin());
      expect(r.status).to.equal(404);
    });

    it("sets resolved_at when resolving and clears it when set back to Pending", async function () {
      const seen = [];
      supabaseService.updateDisputeStatus = async (id, u) => { seen.push(u); return { id }; };
      await call("PUT", "/api/disputes/1/status", { status: "Resolved" }, asAdmin());
      await call("PUT", "/api/disputes/1/status", { status: "Pending" }, asAdmin());
      expect(seen[0].resolved_at).to.be.a("string");
      expect(seen[1].resolved_at).to.equal(null);
    });
  });

  describe("leaderboard", function () {
    beforeEach(async () => { await cacheService.del("leaderboard:current"); });
    after(async () => { await cacheService.del("leaderboard:current"); });

    it("returns a MISS payload when nothing is cached", async function () {
      const r = await call("GET", "/api/leaderboard");
      expect(r.status).to.equal(200);
      expect(r.headers.get("x-cache")).to.equal("MISS");
      expect(r.body.entries).to.deep.equal([]);
    });

    describe("invalidate authorization", function () {
      beforeEach(async () => { await cacheService.set("leaderboard:current", { entries: [] }, 30); });

      const stillCached = async () => (await cacheService.get("leaderboard:current")) !== null;

      it("401 without a token and leaves the cache alone", async function () {
        const r = await call("POST", "/api/leaderboard/invalidate");
        expect(r.status).to.equal(401);
        expect(await stillCached()).to.equal(true);
      });

      it("403 for a participant and leaves the cache alone", async function () {
        const r = await call("POST", "/api/leaderboard/invalidate", undefined, roleAuth("participant"));
        expect(r.status).to.equal(403);
        expect(await stillCached()).to.equal(true);
      });

      for (const role of ["judge", "admin"]) {
        it(`lets a ${role} flush the cache`, async function () {
          const r = await call("POST", "/api/leaderboard/invalidate", undefined, roleAuth(role));
          expect(r.status).to.equal(200);
          expect(await stillCached()).to.equal(false);
        });
      }
    });

    it("returns cached data as a HIT, and invalidate clears it", async function () {
      await cacheService.set("leaderboard:current", { entries: [{ projectId: 1 }] }, 30);
      const hit = await call("GET", "/api/leaderboard");
      expect(hit.headers.get("x-cache")).to.equal("HIT");
      expect(hit.body.entries).to.have.length(1);

      const inv = await call("POST", "/api/leaderboard/invalidate", undefined, roleAuth("judge"));
      expect(inv.status).to.equal(200);

      const after = await call("GET", "/api/leaderboard");
      expect(after.headers.get("x-cache")).to.equal("MISS");
    });
  });

  describe("rate limiting", function () {
    it("returns 429 once the per-route budget is spent, without affecting other routes", async function () {
      supabaseService.updateDisputeStatus = async (id) => ({ id });
      // Dedicated id so this path's bucket is not shared with other tests.
      const path = "/api/disputes/rate-limit-probe/status";
      const statuses = [];
      for (let i = 0; i < 11; i++) {
        statuses.push((await call("PUT", path, { status: "Resolved" }, asAdmin())).status);
      }
      expect(statuses.slice(0, 10)).to.not.include(429);
      expect(statuses[10]).to.equal(429);

      const other = await call("PUT", "/api/disputes/another-probe/status", { status: "Resolved" }, asAdmin());
      expect(other.status).to.equal(200);
    });
  });
});
