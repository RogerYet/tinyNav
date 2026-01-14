import { defaultSeedData, defaultSettings, type CloudNavData, type CloudNavSection, type SiteSettings } from "./data";

export function normalizeSettings(input: CloudNavData["settings"]): SiteSettings {
  const s: any = input ?? {};
  const out: SiteSettings = {
    siteTitle: typeof s.siteTitle === "string" ? s.siteTitle.trim() : defaultSettings.siteTitle,
    siteSubtitle: typeof s.siteSubtitle === "string" ? s.siteSubtitle.trim() : defaultSettings.siteSubtitle,
    homeTagline: typeof s.homeTagline === "string" ? s.homeTagline.trim() : defaultSettings.homeTagline,
    siteIconDataUrl:
      typeof s.siteIconDataUrl === "string"
        ? s.siteIconDataUrl.trim()
        : typeof s.siteIcon === "string"
          ? s.siteIcon.trim()
          : defaultSettings.siteIconDataUrl,
    faviconDataUrl:
      typeof s.faviconDataUrl === "string"
        ? s.faviconDataUrl.trim()
        : typeof s.favicon === "string"
          ? s.favicon.trim()
          : defaultSettings.faviconDataUrl,
    siteIconFit: s.siteIconFit === "cover" ? "cover" : "contain"
  };

  if (!out.siteTitle) out.siteTitle = defaultSettings.siteTitle;
  if (!out.siteSubtitle) out.siteSubtitle = defaultSettings.siteSubtitle;
  if (!out.homeTagline) out.homeTagline = defaultSettings.homeTagline;
  return out;
}

export function normalizeData(data: CloudNavData): CloudNavData {
  const settings = normalizeSettings(data.settings);

  const groups = data.groups.slice().sort((a, b) => a.order - b.order);
  for (let i = 0; i < groups.length; i++) {
    groups[i] = { ...groups[i], order: i, enabled: typeof groups[i].enabled === "boolean" ? groups[i].enabled : true };
  }

  const groupIds = new Set(groups.map((g) => g.id));

  const sectionsInput = (data.sections ?? []).filter((s) => groupIds.has(s.groupId));
  const byGroupSections = new Map<string, CloudNavSection[]>();
  for (const s of sectionsInput) {
    const arr = byGroupSections.get(s.groupId) ?? [];
    arr.push(s);
    byGroupSections.set(s.groupId, arr);
  }

  const sections: CloudNavSection[] = [];
  const sectionIdsByGroup = new Map<string, Set<string>>();
  for (const g of groups) {
    const arr = (byGroupSections.get(g.id) ?? []).slice().sort((a, b) => a.order - b.order);
    for (let i = 0; i < arr.length; i++) sections.push({ ...arr[i], order: i });
    sectionIdsByGroup.set(g.id, new Set(arr.map((s) => s.id)));
  }

  const keptLinks = data.links
    .filter((l) => groupIds.has(l.groupId))
    .map((l) => {
      const raw = typeof (l as any).sectionId === "string" ? String((l as any).sectionId).trim() : "";
      if (!raw) return { ...l, sectionId: undefined };
      const allowed = sectionIdsByGroup.get(l.groupId);
      if (!allowed || !allowed.has(raw)) return { ...l, sectionId: undefined };
      return { ...l, sectionId: raw };
    });

  const links: CloudNavData["links"] = [];
  for (const g of groups) {
    const inGroup = keptLinks.filter((l) => l.groupId === g.id);
    const groupSectionIds = sections.filter((s) => s.groupId === g.id).map((s) => s.id);

    const buckets = new Map<string, typeof inGroup>();
    for (const l of inGroup) {
      const key = l.sectionId?.trim() ? l.sectionId.trim() : "__default__";
      const arr = buckets.get(key) ?? [];
      arr.push(l);
      buckets.set(key, arr);
    }

    for (const sectionId of groupSectionIds) {
      const arr = (buckets.get(sectionId) ?? []).slice().sort((a, b) => a.order - b.order);
      for (let i = 0; i < arr.length; i++) links.push({ ...arr[i], order: i });
    }

    const def = (buckets.get("__default__") ?? []).slice().sort((a, b) => a.order - b.order);
    for (let i = 0; i < def.length; i++) links.push({ ...def[i], order: i, sectionId: undefined });
  }

  return { settings, groups, sections, links };
}

export function seedIfEmpty(existing: CloudNavData | undefined) {
  if (!existing) return defaultSeedData;
  const g = Array.isArray(existing.groups) ? existing.groups : [];
  const l = Array.isArray(existing.links) ? existing.links : [];
  return { ...defaultSeedData, ...existing, groups: g, links: l } as CloudNavData;
}

