import { findWorkoutCopiesInOtherBlocs } from "./appState.js";
import { warning } from "./haptics.js";

// Deleting your own workout, in one place.
//
// This used to live inside TodayPage, which is why the calendar on the Profile
// tab could not delete: the tab renders PlayerProfile from App.jsx, where the
// handler did not exist, so `canDelete` was false and tapping a day opened the
// read-only detail popup instead. Month and All Time had the same gap.
//
// Deletes from this Bloc first, then — only if asked — the same workout's
// copies in the member's other Blocs, one ordinary delete-log each so every
// Bloc gets its own stream retraction. Copies are found before the first
// delete, while this Bloc's state still holds the workout.
export function createOwnLogDeleter({ onLogMutation, groups, groupId, currentUserId, user }) {
  return async (log, { alsoOtherBlocs = false } = {}) => {
    // One buzz for a destructive confirm, in the funnel all three delete
    // buttons reach -- this Bloc only, every Bloc, and the single-workout
    // case -- so deleting from six Blocs still feels like one action.
    void warning();
    const copies = alsoOtherBlocs ? findWorkoutCopiesInOtherBlocs(groups, groupId, currentUserId, log) : [];
    const first = await onLogMutation({action:"delete-log",groupId,actor:user,owner:user,logId:log.id});
    // The optimistic removal has already been rolled back by now, so the
    // workout is back on screen; without this it looks like the tap did nothing.
    if (!first?.ok) {
      window.alert("Workout couldn't be deleted. Please check your connection and try again.");
      return;
    }
    if (!copies.length) return;
    let failed = 0;
    for (const copy of copies) {
      const result = await onLogMutation({action:"delete-log",groupId:copy.groupId,actor:copy.owner,owner:copy.owner,logId:copy.logId});
      if (!result?.ok) failed += 1;
    }
    if (failed) window.alert(`Deleted here, but it couldn't be removed from ${failed === 1 ? "one of your other Blocs" : `${failed} of your other Blocs`}. Please try again from there.`);
  };
}
