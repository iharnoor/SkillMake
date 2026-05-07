import { redirect } from "next/navigation";

export default function MarketplaceIndexRedirect() {
  // The marketplace lives at /. This URL is kept so that links shared before
  // the homepage flip don't 404.
  redirect("/");
}
