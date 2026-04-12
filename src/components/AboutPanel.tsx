import { Heart, ExternalLink } from "lucide-react";
import { useT } from "../i18n/useT";

export default function AboutPanel() {
  const t = useT();

  const stack = [
    { name: "Tauri 2.0", desc: t("about.stack_tauri") },
    { name: "React 18",  desc: t("about.stack_react") },
    { name: "Rust",      desc: t("about.stack_rust")  },
  ];

  const links = [
    { label: t("about.link_love"),         url: "https://love2d.org" },
    { label: t("about.link_love_android"), url: "https://github.com/love2d/love-android" },
    { label: t("about.link_repo"),         url: "https://github.com/Xorice/love2dhub" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("about.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-[#909090] mt-0.5">{t("about.subtitle")}</p>
        </div>

        {/* Logo 区 */}
        <div className="card p-6 flex items-center gap-5">
          <div className="w-14 h-14 bg-pink-500 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
            <Heart size={28} className="text-white" fill="white" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-[#e8e8e8]">LÖVE Hub</div>
            <div className="text-sm text-gray-500 mt-0.5">{t("about.app_desc")}</div>
            <div className="text-xs text-gray-400 mt-1">{t("about.version")} 0.1.0</div>
          </div>
        </div>

        {/* 开发者 */}
        <div className="card p-5">
          <p className="section-title">{t("about.section_author")}</p>
          <div className="flex items-center gap-4">
            <img
              src="https://github.com/Xorice.png"
              alt="Xorice"
              className="w-12 h-12 rounded-full border border-gray-200 dark:border-[#2a2a2a] flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-[#e8e8e8]">Xorice</span>
                <a
                  href="https://github.com/Xorice"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-pink-500 transition-colors"
                >
                  <ExternalLink size={12} />
                  GitHub
                </a>
                <a
                  href="https://space.bilibili.com/302062855"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-pink-500 transition-colors"
                >
                  <ExternalLink size={12} />
                  Bilibili
                </a>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t("about.author_bio")}</p>
            </div>
          </div>
        </div>

        {/* 技术栈 */}
        <div className="card p-5">
          <p className="section-title">{t("about.section_stack")}</p>
          <div className="grid grid-cols-3 gap-3">
            {stack.map((item) => (
              <div key={item.name} className="bg-gray-50 dark:bg-[#252525] rounded-lg px-3 py-2.5 text-center">
                <div className="text-sm font-semibold text-gray-800 dark:text-[#e8e8e8]">{item.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 相关链接 */}
        <div className="card p-5">
          <p className="section-title">{t("about.section_links")}</p>
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#2a2a2a] last:border-0">
                <span className="text-sm text-gray-700 dark:text-[#c0c0c0]">{link.label}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-pink-500 hover:text-pink-600 transition-colors"
                >
                  {link.url}
                  <ExternalLink size={11} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
