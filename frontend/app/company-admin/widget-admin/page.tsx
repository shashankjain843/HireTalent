"use client";

import WidgetAdminSettingsPanel from "@/app/components/WidgetAdminSettingsPanel";
import {
  getCompanyWidgetAdminConfig,
  getCompanyWidgetBehaviorAccess,
  rotateCompanyWidgetEmbedToken,
  updateCompanyWidgetAdminConfig,
} from "@/lib/adminApi";
import { useEffect, useState } from "react";

export default function CompanyWidgetAdminPage() {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    getCompanyWidgetBehaviorAccess()
      .then((resp) => setCanEdit(resp.can_edit_behavior))
      .catch(() => setCanEdit(false));
  }, []);

  return (
    <WidgetAdminSettingsPanel
      roleLabel="tenant-admin"
      loadConfig={getCompanyWidgetAdminConfig}
      saveConfig={updateCompanyWidgetAdminConfig}
      rotateToken={rotateCompanyWidgetEmbedToken}
      canEdit={canEdit}
      editLockedMessage="Superadmin has locked widget behavior edits for tenant admins."
      howToUseHref="/company-admin/how-to-use"
    />
  );
}
