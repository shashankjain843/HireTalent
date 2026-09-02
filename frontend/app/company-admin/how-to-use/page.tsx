"use client";

import WidgetHowToUsePanel from "@/app/components/WidgetHowToUsePanel";
import { getCompanyWidgetAdminConfig } from "@/lib/adminApi";

export default function CompanyHowToUsePage() {
  return (
    <WidgetHowToUsePanel
      title="How to use the widget snippet"
      subtitle="Tenant admin handoff guide for embedding and validating the widget."
      loadConfig={getCompanyWidgetAdminConfig}
    />
  );
}
