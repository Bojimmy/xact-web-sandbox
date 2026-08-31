import { redirect } from "next/navigation";

/** Coldopen is the judge-facing opening experience; Foundry remains at /foundry. */
export default function HomePage() {
  redirect("/coldopen/index.html");
}
