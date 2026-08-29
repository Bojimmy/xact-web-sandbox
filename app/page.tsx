import { redirect } from "next/navigation";

/**
 * The Foundry is the product entrypoint. It begins with the O-Agent liaison
 * interpreting intent; no introductory compliance exercise is required before
 * a judge can ask Xact to build something.
 */
export default function HomePage() {
  redirect("/foundry");
}
