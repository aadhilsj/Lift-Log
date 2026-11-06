import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

// iOS draws a previous/next/Done bar above the keyboard for any focused form
// field in a web view -- the same bar Safari shows. Fero never puts two fields
// on one screen, so both chevrons are permanently greyed out and the bar is
// noise above the sign-in code field. Hide it.
//
// Best-effort, and a wrapper built without this plugin must keep working:
// same guard as haptics.js. iOS only; the call is a no-op elsewhere.
export async function hideKeyboardAccessoryBar() {
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("Keyboard")) return;
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch {
    // Cosmetic only; it must never interrupt start-up.
  }
}
