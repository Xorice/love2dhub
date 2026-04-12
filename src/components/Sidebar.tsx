import { Heart, Package, Download, Wrench, Box, Settings, Info } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { ActiveTab } from "../store/useAppStore";
import { useT } from "../i18n/useT";

export default function Sidebar() {
  const { activeTab, setActiveTab } = useAppStore();
  const t = useT();

  const tabs = [
    { id: "project"  as ActiveTab, label: t("nav.project"),  icon: Package  },
    { id: "versions" as ActiveTab, label: t("nav.versions"), icon: Download  },
    { id: "build"    as ActiveTab, label: t("nav.build"),    icon: Wrench    },
    { id: "packages" as ActiveTab, label: t("nav.packages"), icon: Box       },
    { id: "settings" as ActiveTab, label: t("nav.settings"), icon: Settings  },
    { id: "about"    as ActiveTab, label: t("nav.about"),    icon: Info      },
  ];

  return (
    <aside className="w-52 flex-shrink-0 bg-white dark:bg-[#181818] border-r border-gray-200 dark:border-[#2a2a2a] flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100 dark:border-[#2a2a2a]">
        <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center shadow-sm">
          <Heart size={16} className="text-white" fill="white" />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900 dark:text-[#e8e8e8] leading-tight">LÖVE Hub</div>
          <div className="text-xs text-gray-400 dark:text-[#606060]">v0.1.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === id
                ? "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 font-medium"
                : "text-gray-600 dark:text-[#909090] hover:bg-gray-50 dark:hover:bg-[#252525] hover:text-gray-900 dark:hover:text-[#e8e8e8]"
            }`}
          >
            <Icon
              size={16}
              className={activeTab === id ? "text-pink-500 dark:text-pink-400" : "text-gray-400 dark:text-[#606060]"}
            />
            {label}
          </button>
        ))}
      </nav>

      {/* Bottom hint */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-[#2a2a2a]">
        <p className="text-xs text-gray-400 dark:text-[#444444] text-center">{t("nav.tagline")}</p>
      </div>
    </aside>
  );
}
