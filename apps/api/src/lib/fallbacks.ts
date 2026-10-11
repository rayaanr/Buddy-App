import {
  type ActivityGroup,
  ALL_ACTIVITY_ART,
  avatarArtFor,
  FALLBACK_ART,
  fallbackPath,
  groupChatArt,
  isFallbackUrl,
  pickById,
} from '@buddy/shared';

/**
 * Which of Buddy's pictures goes to people, communities, activities and
 * group chats without a photo (design/fallbacks; served at
 * /fallbacks/<id>.svg). Each always gets the same one: a picture whose words
 * appear in its title or description, otherwise one picked by its id.
 */

/** Words that call for a picture, by picture id (the sets are in @buddy/shared). */
type Words = Record<string, string[]>;

const ACTIVITY_WORDS: Record<ActivityGroup, Words> = {
  Running: {
    'activity-running-01': ['track', 'athletics', 'laps', 'intervals'],
    'activity-running-02': ['road', 'long run', 'easy run'],
    'activity-running-03': ['walk', 'walking', 'hike', 'hiking'],
    'activity-running-04': ['race', '5k', '10k', 'half marathon', 'marathon', 'parkrun'],
    'activity-running-05': ['route', 'trail', 'loop'],
    'activity-running-06': ['tempo', 'pace', 'sprint', 'speed', 'timed'],
    'activity-running-07': ['beginner', 'beginners', 'couch to', 'jog', 'jogging'],
  },
  Sports: {
    'activity-sports-01': ['basketball', 'tennis', 'badminton', 'volleyball', 'netball', 'court'],
    'activity-sports-02': ['cricket'],
    'activity-sports-03': ['padel', 'pickleball', 'squash'],
    'activity-sports-04': ['rugby', 'frisbee', 'dodgeball', 'ball'],
    'activity-sports-05': ['tournament', 'league', 'competition', 'championship'],
    'activity-sports-06': ['football', 'soccer', 'futsal', 'hockey'],
    'activity-sports-07': ['swim', 'swimming', 'pool', 'laps in the pool'],
  },
  Social: {
    'activity-social-01': ['board game', 'board games', 'boardgame', 'quiz', 'trivia', 'dinner'],
    'activity-social-02': ['drinks', 'bar', 'pub', 'toast', 'celebrate', 'birthday'],
    'activity-social-03': ['cards', 'card game', 'poker', 'uno', 'carrom'],
    'activity-social-04': ['chat', 'conversation', 'language exchange', 'coffee', 'meet'],
    'activity-social-05': ['night', 'party', 'dance', 'dancing', 'karaoke'],
    'activity-social-06': ['movie', 'movie night', 'film', 'cinema'],
    'activity-social-07': ['picnic', 'park', 'outdoors'],
  },
  Creative: {
    'activity-creative-01': ['paint', 'painting', 'watercolour', 'watercolor', 'art'],
    'activity-creative-02': ['sketch', 'sketching', 'drawing', 'draw', 'plein air'],
    'activity-creative-03': ['photo', 'photos', 'photography', 'photowalk', 'camera'],
    'activity-creative-04': ['music', 'guitar', 'jam', 'singing', 'choir', 'band', 'drums'],
    'activity-creative-05': ['design', 'craft', 'crafts', 'origami', 'collage'],
    'activity-creative-06': ['pottery', 'ceramics', 'clay'],
    'activity-creative-07': ['writing', 'poetry', 'book club', 'books', 'reading', 'journal'],
  },
  Food: {
    'activity-food-01': ['market', 'markets', 'bazaar', 'pola'],
    'activity-food-02': ['king coconut', 'thambili', 'coconut'],
    'activity-food-03': ['tea', 'high tea', 'chai'],
    'activity-food-04': ['fruit', 'juice', 'farmers'],
    'activity-food-05': ['cooking', 'cook', 'potluck', 'brunch', 'lunch', 'dinner'],
    'activity-food-06': ['hoppers', 'appa', 'string hoppers', 'street food', 'kottu'],
    'activity-food-07': ['rice and curry', 'rice & curry', 'curry'],
  },
};

const LOGO_WORDS: Words = {
  'community-01': ['olympic', 'sports club', 'league'],
  'community-02': ['network', 'networking', 'professionals', 'founders'],
  'community-03': ['hike', 'hiking', 'hikers', 'climb', 'climbing', 'bouldering', 'trek'],
  'community-04': ['meetup', 'meetups', 'friends', 'expats', 'newcomers'],
  'community-05': ['run', 'runners', 'running', 'cycling', 'cyclists', 'riders'],
  'community-06': ['morning', 'sunrise', 'yoga', 'early'],
  'community-07': ['local', 'neighbourhood', 'neighborhood', 'town'],
  'community-08': ['creative', 'makers', 'artists', 'ideas', 'startup'],
  'community-09': ['nature', 'garden', 'gardening', 'plants', 'birding', 'eco', 'green'],
  'community-10': ['beach', 'surf', 'swim', 'swimmers', 'ocean', 'sea', 'diving'],
  'community-11': ['travel', 'explore', 'explorers', 'adventure', 'trips'],
  'community-12': ['fitness', 'gym', 'hiit', 'crossfit', 'workout', 'training'],
  'community-13': ['volunteer', 'volunteers', 'together', 'club'],
};

const COVER_WORDS: Words = {
  'cover-01': ['lake', 'water', 'swim', 'swimmers', 'pool'],
  'cover-02': ['sunset', 'evening', 'dusk'],
  'cover-03': ['explore', 'walking tour', 'walks', 'map', 'travel'],
  'cover-04': ['ocean', 'sea', 'beach'],
  'cover-05': ['festival', 'concert', 'crowd', 'fans'],
  'cover-06': [
    'hike',
    'hiking',
    'hikers',
    'hills',
    'mountain',
    'trek',
    'kandy',
    'ella',
    'nuwara eliya',
  ],
  'cover-07': ['party', 'celebration', 'social', 'fun'],
  'cover-08': ['colombo', 'city', 'urban', 'professionals', 'founders'],
  'cover-09': ['tea', 'estate', 'hatton', 'plantation'],
  'cover-10': ['morning', 'sunrise', 'yoga', 'early'],
  'cover-11': ['surf', 'surfing', 'surfers', 'arugam', 'weligama', 'waves'],
  'cover-12': ['night', 'photography', 'photo', 'lights'],
  'cover-13': ['vesak', 'lantern', 'lanterns', 'culture', 'heritage', 'crafts'],
};

/**
 * Whole words only (plurals count), so "art" doesn't match "start" and
 * "tea" not "team", but "surf" matches "surfers".
 */
const mentions = (text: string, word: string) =>
  new RegExp(
    `(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}(s|es|ers)?($|[^a-z0-9])`,
  ).test(text);

/**
 * The picture whose words best match the text (more matching words win,
 * and ties go to `preferred`); without a match, one of `preferred` chosen
 * by the id.
 */
function choose(id: string, text: string, preferred: string[], words: Words = {}, all = preferred) {
  const lower = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const tile of all) {
    const hits = (words[tile] ?? []).filter((w) => mentions(lower, w)).length;
    if (!hits) continue;
    const score = hits + (preferred.includes(tile) ? 0.5 : 0);
    if (score > bestScore) [best, bestScore] = [tile, score];
  }
  return best ?? pickById(id, preferred);
}

const ALL_ACTIVITY_WORDS: Words = Object.assign({}, ...Object.values(ACTIVITY_WORDS));

export function createFallbacks(publicUrl: string) {
  const url = (tile: string) => `${publicUrl}${fallbackPath(tile)}`;
  return {
    url,
    /** From the set for their gender (men, women, and animals for everyone else). */
    avatar: (userId: string, gender: string | null | undefined) =>
      url(choose(userId, '', avatarArtFor(gender))),
    /** Any activity picture can match its words; otherwise one of its type's. */
    activityCover: (a: { id: string; group: ActivityGroup; title: string; description?: string }) =>
      url(
        choose(
          a.id,
          `${a.title} ${a.description ?? ''}`,
          FALLBACK_ART.activityCover[a.group],
          ALL_ACTIVITY_WORDS,
          ALL_ACTIVITY_ART,
        ),
      ),
    communityLogo: (c: { id: string; name: string; about?: string }) =>
      url(choose(c.id, `${c.name} ${c.about ?? ''}`, FALLBACK_ART.communityLogo, LOGO_WORDS)),
    communityCover: (c: { id: string; name: string; about?: string }) =>
      url(choose(c.id, `${c.name} ${c.about ?? ''}`, FALLBACK_ART.communityCover, COVER_WORDS)),
    /** For a group chat whose activity or community has no photo of its own. */
    groupChat: (chatId: string) => url(groupChatArt(chatId)),
    isFallback: isFallbackUrl,
  };
}
