"use client";

import { useEffect } from "react";
import { ensureWebMcpModelContext } from "@/features/webmcp/client/webmcp-polyfill";

export function WebMcpInitializer() {
  useEffect(() => {
    ensureWebMcpModelContext();
  }, []);

  return null;
}
