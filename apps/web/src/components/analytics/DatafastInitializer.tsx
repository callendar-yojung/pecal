"use client";

import { useEffect } from "react";

const DATAFAST_WEBSITE_ID = "dfid_b8zVL3oRkyzy09SpOPzBs";

export default function DatafastInitializer() {
  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      const { initDataFast } = await import("datafast");
      if (!isMounted) return;

      await initDataFast({
        websiteId: DATAFAST_WEBSITE_ID,
      });
    };

    void boot();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
