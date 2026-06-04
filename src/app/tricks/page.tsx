import { permanentRedirect } from "next/navigation";

// The "tricks" collection was reframed as "budget" — keep the old URL alive
// with a 308 so existing links and indexed pages land on the new route.
export default function TricksRedirect() {
  permanentRedirect("/budget");
}
