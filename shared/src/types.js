"use strict";
/**
 * Shared TypeScript types for USS Enterprise Photo Contest Bot
 * Used across bot, web, and functions workspaces
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collections = exports.ContestStatus = void 0;
/**
 * Contest status enum
 */
var ContestStatus;
(function (ContestStatus) {
    ContestStatus["CREATED"] = "created";
    ContestStatus["SUBMISSION"] = "submission";
    ContestStatus["VOTING"] = "voting";
    ContestStatus["RESULTS"] = "results";
    ContestStatus["CANCELLED"] = "cancelled";
})(ContestStatus || (exports.ContestStatus = ContestStatus = {}));
/**
 * Firestore collection names
 */
exports.Collections = {
    CONTESTS: 'contests',
    SUBMISSIONS: 'submissions',
    VOTES: 'votes',
};
//# sourceMappingURL=types.js.map