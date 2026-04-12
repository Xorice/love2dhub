import { useTranslation } from "react-i18next";

/** Typed wrapper around react-i18next's useTranslation */
export function useT() {
  const { t } = useTranslation();
  return t;
}
