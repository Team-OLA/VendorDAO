"use client";

import { useTranslation } from "react-i18next";
import type { Ward } from "@/lib/wards";
import { Badge } from "./ui/Badge";

export function WardBadge({ ward }: { ward: Ward }) {
  const { t } = useTranslation();
  return <Badge variant={ward === "Citywide" ? "zinc" : "indigo"}>{t(`ward.${ward}`)}</Badge>;
}
