import { redirect } from "next/navigation";
import { features, type Feature } from "./features";

/**
 * Sends anybody who lands on a switched-off page back to the home screen,
 * so an old bookmark cannot show half a feature.
 */
export function requireFeature(feature: Feature) {
  if (!features[feature]) redirect("/app");
}
