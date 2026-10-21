// The Bloc header lives in Nav.jsx, but whether a member's profile is open is
// state inside TodayPage, HistoryPage and MonthPage. Rather than lift four
// separate copies of it, App.jsx holds one handler and hands the setter down
// here; whichever PlayerProfile is open publishes its own onBack while it is
// mounted, and takes it away again on the way out.
//
// The Profile tab does not publish: it is a tab, so there is nothing to go
// back to, and the Bloc name must stay.
const ProfileBackContext = React.createContext(null);

export { ProfileBackContext };
