export type Group = {
  id: string;
  name: string;
  order: number;
  enabled?: boolean;
};

export type LinkItem = {
  id: string;
  groupId: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  order: number;
};

export type CloudNavData = {
  groups: Group[];
  links: LinkItem[];
};
