/**
 * DRAFT terms of use. Apple requires an EULA-style agreement with zero
 * tolerance for objectionable content in apps with user-generated content.
 * Have it reviewed, replace CONTACT_EMAIL and the effective date, then ship.
 */
export const TERMS_UPDATED = 'DRAFT — not yet in effect';

export const termsHtml = (contact: string) => `
<h2>Using Buddy</h2>
<p>Buddy helps people in Sri Lanka meet up for activities. You must be at least 18 to use it. Keep your account to yourself and give your real name.</p>

<h2>No tolerance for abuse</h2>
<p>Don’t post or send anything hateful, harassing, sexual, violent, illegal or misleading, and don’t spam. We review every report within 24 hours. We remove content that breaks these rules and remove the accounts that post it.</p>

<h2>Meeting people</h2>
<p>Activities are run by the people who host them, not by Buddy. Meet in public places, tell someone where you’re going, and use your judgement. Block and report anyone who makes you uncomfortable.</p>

<h2>Your content</h2>
<p>You own what you post. You let us show it to other Buddy users so the app works. Deleting your account removes your profile and photos; see the privacy policy for what stays.</p>

<h2>Changes and ending</h2>
<p>We may change these terms and will say so in the app. You can stop using Buddy and delete your account at any time. We may suspend accounts that break these terms.</p>

<h2>Contact</h2>
<p><a href="mailto:${contact}">${contact}</a></p>
`;
