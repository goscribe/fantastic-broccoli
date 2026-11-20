import type { PlanCaps } from "./api/account";

/**
 * The user already has a priced plan, paid for or granted to them
 * (a complimentary grant, e.g. free Pro during a billing outage):
 * no subscribe wall.
 */
export function hasPlanAccess(caps: Pick<PlanCaps, "paid" | "complimentary">): boolean {
  return caps.paid || caps.complimentary === true;
}

/**
 * The user pays (or is in a card-required trial): the only state reported as
 * a paid conversion. A complimentary grant never is; the server already sets
 * `paid` to false for one, and this keeps it so if both were ever set.
 */
export function isPaidConversion(caps: Pick<PlanCaps, "paid" | "complimentary">): boolean {
  return caps.paid && caps.complimentary !== true;
}
