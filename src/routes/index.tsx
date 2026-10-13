import { createFileRoute } from "@tanstack/react-router";
import { MisDeudasApp } from "@/components/misdeudas/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MisDeudasApp />;
}
