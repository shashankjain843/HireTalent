import { Suspense } from "react";

import { WidgetChatInterface } from "../components/WidgetChatInterface";

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading widget...</div>}>
      <WidgetChatInterface />
    </Suspense>
  );
}
