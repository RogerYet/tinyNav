export type SiteSettings = {
  siteTitle: string;
  siteSubtitle: string;
  homeTagline: string;
  siteIconDataUrl: string;
  faviconDataUrl: string;
  siteIconFit: "contain" | "cover";
};

export type CloudNavSection = { id: string; groupId: string; name: string; order: number };

export type CloudNavLink = {
  id: string;
  groupId: string;
  sectionId?: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  order: number;
};

export type CloudNavGroup = { id: string; name: string; order: number; enabled?: boolean };

export type CloudNavData = {
  settings?: SiteSettings;
  groups: CloudNavGroup[];
  sections?: CloudNavSection[];
  links: CloudNavLink[];
};

export const DATA_KEY = "cloudnav:data";
export const LOGIN_FAIL_KEY_PREFIX = "cloudnav:login-fails:";
export const SESSION_COOKIE = "cloudnav_session";
export const SESSION_DAYS = 7;

export const defaultSettings: SiteSettings = {
  siteTitle: "AppleBar",
  siteSubtitle: "个人导航",
  homeTagline: "轻盈、克制、随手可用。",
  siteIconDataUrl: "",
  faviconDataUrl: "",
  siteIconFit: "contain"
};

export const defaultSeedData: CloudNavData = {
  settings: defaultSettings,
  groups: [
    { id: "g-dev", name: "开发", order: 0, enabled: true },
    { id: "g-life", name: "日常", order: 1, enabled: true },
    { id: "g-ref", name: "参考", order: 2, enabled: true }
  ],
  sections: [],
  links: [
    {
      id: "l-cf",
      groupId: "g-dev",
      title: "Cloudflare Docs",
      url: "https://developers.cloudflare.com/",
      description: "Pages / Functions / Workers / Durable Objects 官方文档",
      order: 0
    },
    {
      id: "l-vite",
      groupId: "g-dev",
      title: "Vite",
      url: "https://vitejs.dev/",
      description: "快速、现代的前端构建工具",
      order: 1
    },
    {
      id: "l-react",
      groupId: "g-ref",
      title: "React",
      url: "https://react.dev/",
      description: "UI 库与最佳实践",
      order: 0
    }
  ]
};

