import { AUTH_ROUTING_ENTRY, getAppExperience, getRoleHomeRoute, SIGNED_OUT_HOME_ROUTE } from "../roleNavigation";

describe("role navigation", () => {
  it.each([
    ["customer", "customer", "/(customer)/(tabs)"],
    ["driver", "driver", "/(driver)"],
    ["pharmacist", "pharmacist", "/(pharmacist)"],
    ["manager", "pharmacist", "/(pharmacist)"],
    ["admin", "pharmacist", "/(pharmacist)"],
  ] as const)("maps %s to the %s experience", (role, experience, route) => {
    expect(getAppExperience(role)).toBe(experience);
    expect(getRoleHomeRoute(role)).toBe(route);
  });

  it("uses the customer experience while a role is unavailable", () => {
    expect(getAppExperience(undefined)).toBe("customer");
    expect(getRoleHomeRoute(null)).toBe("/(customer)/(tabs)");
  });

  it("uses a stable customer destination after sign-out", () => {
    expect(SIGNED_OUT_HOME_ROUTE).toBe("/(customer)/(tabs)");
  });

  it("routes role changes through the app entry screen", () => {
    expect(AUTH_ROUTING_ENTRY).toBe("/");
  });
});
