import { describe, expect, it } from "vitest";

import {
  atLimit,
  aiQuotaApplies,
  bestPlan,
  canCreateWorkspace,
  canInviteMembers,
  checkGate,
  getEntitlements,
  isUpgrade,
  nextPlan,
  remaining,
  withinAiQuota,
  type Entitlements,
} from "./plans";

const free = getEntitlements("free");
const pro = getEntitlements("pro");
const team = getEntitlements("team");

describe("getEntitlements", () => {
  it("resolves a known plan and enforces it", () => {
    const e = getEntitlements("pro");
    expect(e.plan).toBe("pro");
    expect(e.enforced).toBe(true);
    expect(e.limits.seats).toBe(3);
    expect(e.features.team).toBe(true);
  });

  it("treats a missing plan column as unenforced, not as free", () => {
    // The case that matters: code deployed, tenancy migration not applied yet.
    // Resolving to `free` would paywall a working self-hosted install.
    for (const value of [null, undefined, ""]) {
      const e = getEntitlements(value);
      expect(e.plan).toBeNull();
      expect(e.enforced).toBe(false);
      expect(e.features.team).toBe(true);
      expect(e.limits.seats).toBeNull();
    }
  });

  it("treats an unknown plan value as unenforced", () => {
    const e = getEntitlements("enterprise_legacy");
    expect(e.enforced).toBe(false);
  });

  it("does not let a caller mutate shared plan state", () => {
    const e = getEntitlements("free");
    e.limits.seats = 999;
    expect(getEntitlements("free").limits.seats).toBe(1);
  });
});

describe("free tier", () => {
  it("is solo: one seat, one workspace", () => {
    expect(free.limits.seats).toBe(1);
    expect(free.limits.workspaces).toBe(1);
    expect(canInviteMembers(free, 0)).toBe(false);
    expect(canCreateWorkspace(free, 1)).toBe(false);
  });

  it("still allows creating the first workspace", () => {
    expect(canCreateWorkspace(free, 0)).toBe(true);
  });

  it("meters platform AI but leaves a usable allowance", () => {
    expect(withinAiQuota(free, 59, false)).toBe(true);
    expect(withinAiQuota(free, 60, false)).toBe(false);
  });

  it("waives the AI quota when the workspace brings its own key", () => {
    // Their provider bills them already; a platform cap here is double-charging.
    expect(aiQuotaApplies(free, true)).toBe(false);
    expect(withinAiQuota(free, 10_000, true)).toBe(true);
    expect(withinAiQuota(free, 10_000, false)).toBe(false);
  });
});

describe("team tier", () => {
  it("has no AI meter at all", () => {
    expect(team.limits.aiMessagesPerMonth).toBeNull();
    expect(aiQuotaApplies(team, false)).toBe(false);
    expect(withinAiQuota(team, 500_000, false)).toBe(true);
  });

  it("can invite until seats are exhausted", () => {
    expect(canInviteMembers(team, 24)).toBe(true);
    expect(canInviteMembers(team, 25)).toBe(false);
  });
});

describe("unenforced entitlements never block", () => {
  const off = getEntitlements(null);

  it.each([
    ["invite_member", { type: "invite_member", currentSeats: 9_999 }],
    ["create_workspace", { type: "create_workspace", ownedCount: 9_999 }],
    ["enable_rule", { type: "enable_rule", enabledCount: 9_999 }],
    ["ai_message", { type: "ai_message", usedThisMonth: 9_999, hasOwnProviderKey: false }],
  ] as const)("%s passes with billing unconfigured", (_name, action) => {
    expect(checkGate(off, action)).toBeNull();
  });
});

describe("checkGate", () => {
  it("explains a seats block by feature before hitting the limit", () => {
    // Free has 1 seat and no team feature; the upgrade prompt should name
    // "Team collaboration", not a misleading "1 seat" limit.
    const gate = checkGate(free, { type: "invite_member", currentSeats: 0 });
    expect(gate).toEqual({ kind: "feature", feature: "team" });
  });

  it("reports the seats limit once the feature is available", () => {
    const gate = checkGate(pro, { type: "invite_member", currentSeats: 3 });
    expect(gate).toEqual({ kind: "seats", limit: 3 });
  });

  it("allows the action under the limit", () => {
    expect(checkGate(pro, { type: "invite_member", currentSeats: 2 })).toBeNull();
    expect(checkGate(pro, { type: "create_workspace", ownedCount: 4 })).toBeNull();
    expect(checkGate(pro, { type: "create_workspace", ownedCount: 5 })).toEqual({
      kind: "workspaces",
      limit: 5,
    });
  });

  it("caps automation rules on free and lifts the cap on pro", () => {
    expect(checkGate(free, { type: "enable_rule", enabledCount: 3 })).toEqual({
      kind: "automation_rules",
      limit: 3,
    });
    expect(checkGate(pro, { type: "enable_rule", enabledCount: 500 })).toBeNull();
  });

  it("ignores the AI gate for a BYOK workspace even when over quota", () => {
    const gate = checkGate(free, {
      type: "ai_message",
      usedThisMonth: 500,
      hasOwnProviderKey: true,
    });
    expect(gate).toBeNull();
  });
});

describe("limit math", () => {
  it("treats null as unlimited", () => {
    expect(atLimit(1_000_000, null)).toBe(false);
    expect(remaining(null, 7)).toBeNull();
  });

  it("never returns a negative remainder", () => {
    expect(remaining(3, 10)).toBe(0);
  });

  it("counts over-limit as at-limit rather than throwing", () => {
    expect(atLimit(5, 3)).toBe(true);
  });
});

describe("upgrade paths", () => {
  it("walks the ladder in order", () => {
    expect(nextPlan("free")).toBe("pro");
    expect(nextPlan("pro")).toBe("team");
    expect(nextPlan("team")).toBeNull();
  });

  it("treats moving up as an upgrade and moving down as not", () => {
    expect(isUpgrade("free", "pro")).toBe(true);
    expect(isUpgrade("pro", "free")).toBe(false);
    expect(isUpgrade(null, "free")).toBe(true);
  });
});

describe("billing-enabled switch", () => {
  it("reports no plan and no limits when billing is off", () => {
    // The state a self-hoster is in right after `supabase db push`: the plan
    // column exists and says 'free', but nobody has enabled enforcement. If this
    // regressed, migrating would silently rate-limit their assistant.
    const e = getEntitlements("free", false);
    expect(e.enforced).toBe(false);
    expect(e.plan).toBeNull();
    expect(e.limits.aiMessagesPerMonth).toBeNull();
    expect(e.limits.workspaces).toBeNull();
    expect(e.features.team).toBe(true);
  });

  it("ignores even a paid plan when billing is off", () => {
    expect(getEntitlements("team", false).enforced).toBe(false);
  });

  it("still enforces nothing when billing is on but the column is absent", () => {
    // Two independent off-switches, both must hold.
    expect(getEntitlements(null, true).enforced).toBe(false);
  });

  it("passes every gate when billing is off", () => {
    const off = getEntitlements("free", false);
    expect(checkGate(off, { type: "create_workspace", ownedCount: 999 })).toBeNull();
    expect(checkGate(off, { type: "invite_member", currentSeats: 999 })).toBeNull();
    expect(
      checkGate(off, { type: "ai_message", usedThisMonth: 999, hasOwnProviderKey: false })
    ).toBeNull();
  });

  it("enforces the free tier once billing is switched on", () => {
    const on = getEntitlements("free", true);
    expect(on.enforced).toBe(true);
    expect(on.limits.aiMessagesPerMonth).toBe(60);
    expect(checkGate(on, { type: "ai_message", usedThisMonth: 60, hasOwnProviderKey: false })).not.toBeNull();
    // ...and an externally-funded call is still waived on the paid-plan path.
    expect(checkGate(on, { type: "ai_message", usedThisMonth: 999, hasOwnProviderKey: true })).toBeNull();
  });
});

describe("bestPlan", () => {
  it("picks the highest plan an account holds", () => {
    expect(bestPlan(["free", "team", "pro"])).toBe("team");
    expect(bestPlan(["free", "free"])).toBe("free");
    expect(bestPlan(["free", "pro"])).toBe("pro");
  });

  it("ignores unknown and missing plan values", () => {
    expect(bestPlan([null, undefined, "enterprise_legacy", "free"])).toBe("free");
  });

  it("returns null when nothing is a real plan", () => {
    // Pre-migration: no `plan` column at all, so a new workspace inherits
    // nothing and the column default applies.
    expect(bestPlan([null, null])).toBeNull();
    expect(bestPlan([])).toBeNull();
  });
});

describe("plan catalog integrity", () => {
  const all: Entitlements[] = [free, pro, team];

  it("is monotonically increasing in seats", () => {
    const seats = all.map((e) => e.limits.seats);
    expect(seats[0]).toBeLessThan(seats[1]!);
    expect(seats[1]).toBeLessThan(seats[2]!);
  });

  it("only uses null to mean unlimited, never zero", () => {
    for (const e of all) {
      for (const value of Object.values(e.limits)) {
        expect(value).not.toBe(0);
      }
    }
  });

  it("prices free at zero and every paid tier above it", () => {
    expect(getEntitlements("free").enforced).toBe(true);
    expect(pro.limits.seats).toBeGreaterThan(free.limits.seats!);
  });
});
