/** Stock photo helpers. Images load from the network; components fall back to a striped hue. */
export const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;

export const portrait = (path: string) => `https://randomuser.me/api/portraits/${path}.jpg`;

export const MY_AVATAR = portrait('men/32');
