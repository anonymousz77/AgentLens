import type { ReactNode } from "react";
import NavBar from "./NavBar";

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className="flex h-full min-h-screen">
      <NavBar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
