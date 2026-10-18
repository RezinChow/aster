import { beforeEach, expect, test } from "bun:test";
import {
  getCloudPersonCredential,
  setCloudPersonCredential,
  setUserSession,
} from "./userSession";

beforeEach(() => localStorage.clear());

const credential = {
  accessToken: `a3s_${"a".repeat(64)}`,
  organizationId: "organization",
  principalId: "principal",
  subject: "subject",
};

test("signing in again discards the old Cloud credential so updated scopes are issued", () => {
  setUserSession("a3s_us_old", "organization");
  setCloudPersonCredential(credential);
  setUserSession("a3s_us_new", "organization");
  expect(getCloudPersonCredential()).toBeNull();
});

test("retaining the same user session preserves its Cloud credential", () => {
  setUserSession("a3s_us_current", "organization");
  setCloudPersonCredential(credential);
  setUserSession("a3s_us_current", "organization");
  expect(getCloudPersonCredential()).toEqual(credential);
});

test("changing the organization discards the previous organization credential", () => {
  setUserSession("a3s_us_current", "organization");
  setCloudPersonCredential(credential);
  setUserSession("a3s_us_current", "another-organization");
  expect(getCloudPersonCredential()).toBeNull();
});
