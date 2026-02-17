import { Suspense } from "react";
import PlansClient from "../PlansClient";

export default function PersonalPlansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <PlansClient mode="personal" />
    </Suspense>
  );
}
