import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Optional native feedback: browsers/sandbox never vibrate, and an older
// native wrapper without this plugin must keep working. Await inside the
// catch boundary so rejected bridge calls cannot become unhandled promises.
async function playHaptic(method, options) {
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("Haptics")) return;
    await Haptics[method](options);
  } catch {
    // Haptics are best-effort; they must never interrupt the user's action.
  }
}

export const tapLight = () => playHaptic("impact", { style: ImpactStyle.Light });
export const tapMedium = () => playHaptic("impact", { style: ImpactStyle.Medium });
export const success = () => playHaptic("notification", { type: NotificationType.Success });
export const warning = () => playHaptic("notification", { type: NotificationType.Warning });
export const error = () => playHaptic("notification", { type: NotificationType.Error });
