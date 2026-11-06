// What the player's reporting watch does at each look (every 15 s while the picture plays): start the progress reports
// again when they are not running, or write the state to the report. It is a function of what the watch can see, so the
// rules can be tried without a player.
export const AFTER_RELOAD_MS = 15 * 60 * 1000;
export const QUIET_MS = 90 * 1000;
export const HEAL_EVERY_MS = 60 * 1000;
const LOG_AFTER_RELOAD_EVERY_MS = 60 * 1000;
const LOG_FAULT_EVERY_MS = 5 * 60 * 1000;
// Looks (15 s each) a background stop may stay pending while the picture plays before the watch stops waiting for the
// resume path, which has certainly run by then if it ever will.
export const PENDING_BACKGROUND_STOP_LOOKS = 8;

const NOTHING = {heal: false, log: null};

// state is what playback.getReportingState() says. noSessionChecks is how many looks in a row found no session, and
// healedAt, loggedAt and faultLoggedAt when the watch last started the reports, last wrote a check line and last wrote a
// fault line (apart, so the minute by minute lines after a reload do not hold a fault back). reloadedAt is when the
// stream was last reopened by a reload, and reloadedHere whether that was for the item now playing.
export const watchReporting = ({state, now, noSessionChecks, healedAt, loggedAt, faultLoggedAt = 0, reloadedAt, reloadedHere}) => {
	// Playing, a session to report on and the reports off. Once a minute at most, so a path that leaves them off on
	// purpose cannot make this a loop.
	if (state.hasSession && !state.progressActive) {
		if (now - healedAt < HEAL_EVERY_MS) return NOTHING;
		return {heal: true, log: {level: 'error', message: 'Playback: progress reporting had stopped, started again'}};
	}
	const afterReload = Boolean(reloadedAt) && Boolean(reloadedHere) && now - reloadedAt < AFTER_RELOAD_MS;
	const quiet = state.hasSession && state.sinceOkMs != null && state.sinceOkMs > QUIET_MS;
	// No session for two looks in a row: the gap between two episodes is not one
	const noSession = noSessionChecks >= 2;
	if (!noSession && !quiet && !afterReload) return NOTHING;
	if (noSession || quiet) {
		if (now - faultLoggedAt < LOG_FAULT_EVERY_MS) return NOTHING;
		return noSession
			? {heal: false, fault: true, log: {level: 'info', message: 'Playback: playing with no session to report on'}}
			: {heal: false, fault: true, log: {level: 'error', message: 'Playback: the server has not taken a progress report for a while'}};
	}
	if (now - loggedAt < LOG_AFTER_RELOAD_EVERY_MS) return NOTHING;
	return {heal: false, log: {level: 'info', message: 'Reporting check after a reload'}};
};
