export type DayLabel = 'Today' | 'Tonight' | 'Tomorrow' | 'Sat' | 'Sun';

/** Broad grouping used by Discover filters. */
export type ActivityGroup = 'Social' | 'Sports' | 'Running' | 'Creative' | 'Food';

export type MessageStatus = 'sending' | 'sent' | 'seen';

export type ChatMessage =
  | { id: string; kind: 'system'; text: string }
  | { id: string; kind: 'other'; from: string; text: string }
  | { id: string; kind: 'me'; text: string; time?: string; status: MessageStatus };

export interface Activity {
  id: string;
  title: string;
  /** Uppercase category label shown on cards, e.g. "RUNNING". */
  category: string;
  group: ActivityGroup;
  /** The interest this activity matches, used to rank the swipe deck. */
  interest?: string;
  day: DayLabel;
  time: string;
  place: string;
  /** Secondary location line, e.g. "Colombo 03 · 1.2 km". */
  placeDetail: string;
  distance: string;
  area: string;
  capacity: number;
  going: number;
  host: string;
  hostColor: string;
  hostMeta: string;
  hue: string;
  image?: string;
  description: string;
  communityId: string | null;
  joined?: boolean;
  hosting?: boolean;
  messages: ChatMessage[];
}

export interface Community {
  id: string;
  name: string;
  members: string;
  weekly: number;
  hue: string;
  image: string;
  about: string;
  rules: string[];
  people: string[];
  joined: boolean;
}

export interface UserProfile {
  name: string;
  area: string;
  since: string;
  bio: string;
  tags: string[];
  hosted: number;
  joined: number;
  avatar: string;
}

export interface Account {
  name: string;
  location: string;
}
