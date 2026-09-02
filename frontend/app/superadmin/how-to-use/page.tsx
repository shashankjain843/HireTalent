"use client";

import WidgetHowToUsePanel from "@/app/components/WidgetHowToUsePanel";
import { getSuperadminWidgetAdminConfig } from "@/lib/adminApi";

export default function SuperadminHowToUsePage() {
  return (
    <WidgetHowToUsePanel
      title="How to use the widget snippet"
      subtitle="Superadmin guide for deployment validation and client installation handoff."
      loadConfig={getSuperadminWidgetAdminConfig}
    />
  );
}
