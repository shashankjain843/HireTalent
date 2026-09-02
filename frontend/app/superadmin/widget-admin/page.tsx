"use client";

import WidgetAdminSettingsPanel from "@/app/components/WidgetAdminSettingsPanel";
import {
  getSuperadminWidgetAdminConfig,
  rotateSuperadminWidgetEmbedToken,
  updateSuperadminWidgetAdminConfig,
} from "@/lib/adminApi";

export default function SuperadminWidgetAdminPage() {
  return (
    <WidgetAdminSettingsPanel
      roleLabel="superadmin"
      loadConfig={getSuperadminWidgetAdminConfig}
      saveConfig={updateSuperadminWidgetAdminConfig}
      rotateToken={rotateSuperadminWidgetEmbedToken}
      canEdit
      howToUseHref="/superadmin/how-to-use"
    />
  );
}
