"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeDiscordCode = void 0;
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin SDK
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
// Export Cloud Functions
var exchangeDiscordCode_1 = require("./auth/exchangeDiscordCode");
Object.defineProperty(exports, "exchangeDiscordCode", { enumerable: true, get: function () { return exchangeDiscordCode_1.exchangeDiscordCode; } });
//# sourceMappingURL=index.js.map