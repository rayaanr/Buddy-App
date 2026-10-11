import { RETENTION } from '@buddy/shared';

/**
 * DRAFT privacy policy, written from what the code actually collects.
 * Have it reviewed, replace CONTACT_EMAIL and the effective date, then ship.
 * Served at /privacy (see modules/legal/routes.ts); the app links to it.
 */
export const PRIVACY_UPDATED = 'DRAFT — not yet in effect';

export const privacyHtml = (contact: string) => `
<h2>What we collect</h2>
<ul>
  <li><strong>Your account:</strong> email address (to send sign-in codes), your name, and the home town you pick. If you sign in with Google, we get your name, email address and profile photo from Google.</li>
  <li><strong>Your profile:</strong> bio, interests, availability and an optional photo. Interests you mark “Not into” only change what we suggest to you.</li>
  <li><strong>About you (private):</strong> your gender and birth year. We use your birth year to keep Buddy for people 18 and over. Neither is shown to other people.</li>
  <li><strong>What you do on Buddy:</strong> activities you host or join, communities you join, group chat messages, people you block, and reports you file.</li>
  <li><strong>After an activity:</strong> whether the host marked you as there, and your answer to “would you go again?”. Only the host sees who they marked. Answers are only shown as a total on the host’s profile, never who gave them.</li>
  <li><strong>Location:</strong> only when you tap something like “Near me” or pin a meeting point. Your phone’s position is sent with that request to find nearby activities and is not stored. A meeting point you pin is stored with the activity and shown to others.</li>
  <li><strong>Notifications:</strong> a push token for your device, if you allow notifications.</li>
</ul>

<h2>How we use it</h2>
<p>To run the app: sign you in, show activities near you, let people going to the same activity chat, send reminders you’ve switched on, and keep the community safe. We don’t sell your data or use it for advertising.</p>

<h2>Who sees what</h2>
<p>Other people see your name, photo, town, bio and interests, the activities you host, and your messages in chats you’ve joined. Your email address is never shown. People you block can’t see your profile, activities or messages.</p>

<h2>Services we use</h2>
<ul>
  <li>Resend, to email sign-in codes.</li>
  <li>Cloudflare R2, to store photos.</li>
  <li>Google, if you choose to sign in with Google.</li>
  <li>Expo, Apple and Google, to deliver push notifications.</li>
  <li>OpenStreetMap (via Photon) or Google Places, to search for meeting points.</li>
  <li>Sentry, to tell us when the app or our servers crash. Crash reports describe the error and your device, not who you are.</li>
</ul>

<h2>How long we keep messages</h2>
<p>Group chat messages are stored on our servers so everyone in the chat can read them, and so reported messages can be reviewed. An activity’s chat is deleted ${RETENTION.activityChatDays} days after the activity. Community chats keep the last ${RETENTION.communityChatDays} days of messages (or the last ${RETENTION.communityChatKeep.toLocaleString('en')}, if that’s more). Photos in chats are deleted after ${RETENTION.chatPhotoDays} days. Messages someone has reported are kept until a moderator has reviewed them.</p>

<h2>Moderation</h2>
<p>Reports go to our moderators, who review them within 24 hours and may remove content or accounts that break the rules.</p>

<h2>Deleting your account</h2>
<p>Settings → Delete account removes your account, profile, photos (including ones you sent in chats) and email address straight away. Upcoming activities you host are cancelled. Messages you sent stay in their chats as “Deleted account”, and reports about you are kept for moderation.</p>

<h2>Contact</h2>
<p>Questions or requests: <a href="mailto:${contact}">${contact}</a>.</p>
`;
