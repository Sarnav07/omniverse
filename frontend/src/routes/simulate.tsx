import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/simulate")({
  component: () => <Navigate to="/demo" />,
});
