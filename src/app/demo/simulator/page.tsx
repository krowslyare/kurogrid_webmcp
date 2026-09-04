import type { Metadata } from "next";
import { SimulatorStage } from "./SimulatorStage";

export const metadata: Metadata = {
  title: "Dual-Screen Live Parity Simulator · Kuro Agent",
  description: "Synchronized dual-surface WebMCP demonstration: Customer in-browser booking on left, Clinic Owner Copilot on right.",
};

export default function LiveParitySimulatorPage() {
  return <SimulatorStage />;
}

