import type { NextConfig } from "next";
import { parseEnvironment } from "./src/lib/env";

parseEnvironment(process.env);

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
};

export default nextConfig;
