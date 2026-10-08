import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), query: vi.fn(), requestLink: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("./http", () => ({
  readJson: (request: Request) => request.json(),
  sessionFromRequest: mocks.session,
  json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
}));
vi.mock("./db", () => ({ db: () => ({ query: mocks.query }) }));
vi.mock("./partner", () => ({ requestLink: mocks.requestLink }));
import { Route } from "../../routes/api/hud/pair";

const post = Route.options.server!.handlers!.POST as (args: {
  request: Request;
}) => Promise<Response>;
function pair(token = "wearer-session", code = "ABC123") {
  return post({
    request: new Request("https://example.test/api/hud/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, code }),
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({
    id: "real-avatar-user",
    role: "partner",
    avatar_name: "Partner Resident",
  });
  mocks.query.mockResolvedValue({ rows: [{ id: "pregnancy", user_id: "mom", mom_name: "Mom" }] });
  mocks.requestLink.mockResolvedValue({ status: "active" });
});

describe("partner screen pairing identity", () => {
  it.each(["", "expired-session"])(
    "rejects invalid session %s without creating or requesting a link",
    async (token) => {
      mocks.session.mockResolvedValue(null);
      const response = await pair(token);
      expect(response.status).toBe(401);
      expect((await response.json()).error).toContain("choose Sync");
      expect(mocks.query).not.toHaveBeenCalled();
      expect(mocks.requestLink).not.toHaveBeenCalled();
    },
  );
  it("rejects a mom session on the partner pairing endpoint", async () => {
    mocks.session.mockResolvedValue({ id: "mom", role: "mom" });
    expect((await pair()).status).toBe(403);
    expect(mocks.requestLink).not.toHaveBeenCalled();
  });
  it("retains the wearer's existing identity when reconnecting to the same pregnancy", async () => {
    const response = await pair();
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("active");
    expect(mocks.requestLink).toHaveBeenCalledWith(
      expect.objectContaining({ partnerUserId: "real-avatar-user" }),
    );
  });
  it("rejects a malformed code before querying pregnancy data", async () => {
    expect((await pair("wearer-session", "123")).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
