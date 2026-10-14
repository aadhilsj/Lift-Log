// MOCKUP ONLY (variant q). The Bloc header lives in Nav.jsx, but whether a
// member profile is open is state inside TodayPage and HistoryPage, so the
// header has no way to know. This is the smallest possible bridge: the open
// profile publishes its own back handler, and the header subscribes.
//
// A real build should lift `viewPlayer` into App.jsx and pass the handler down
// as an ordinary prop rather than keep this module-level store.
let current = null;
const subscribers = new Set();

function setHeaderBack(fn) {
  current = typeof fn === "function" ? fn : null;
  subscribers.forEach(notify => notify(current));
}

function useHeaderBack() {
  const [value, setValue] = React.useState(current);
  React.useEffect(() => {
    const notify = next => setValue(() => next);
    subscribers.add(notify);
    setValue(() => current);
    return () => { subscribers.delete(notify); };
  }, []);
  return value;
}

export { setHeaderBack, useHeaderBack };
