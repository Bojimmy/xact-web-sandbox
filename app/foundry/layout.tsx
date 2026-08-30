import { FoundrySessionProvider } from "./foundry-session";

export default function FoundryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <FoundrySessionProvider>{children}</FoundrySessionProvider>;
}
