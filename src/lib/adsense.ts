// Google AdSense configuration.
// Replace with your real Publisher ID (starts with "ca-pub-") once approved.
// You can also set VITE_ADSENSE_CLIENT in your env to override.
export const ADSENSE_CLIENT =
  (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ??
  "ca-pub-XXXXXXXXXXXXXXXX";

export const ADSENSE_ENABLED = ADSENSE_CLIENT.startsWith("ca-pub-") &&
  !ADSENSE_CLIENT.includes("XXXX");

// Ad slot IDs — create these in your AdSense dashboard and paste here.
export const AD_SLOTS = {
  homeFeed: "0000000000",
  testimoniesList: "0000000000",
};
