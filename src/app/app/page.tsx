import { features } from "@/lib/features";
import HomeToday from "./HomeToday";
import UsView from "./UsView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Our Space" };

/**
 * With the daily loop turned on, home is the Today dashboard. With it off, the
 * app is only about the two of you, so that page is home instead.
 */
export default function AppHomePage() {
  return features.moments ? <HomeToday /> : <UsView />;
}
