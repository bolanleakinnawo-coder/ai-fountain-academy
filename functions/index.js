// AI Fountain Academy Cloud Functions.
// Each concern lives in its own module under src/.
const payments = require("./src/payments");
const video = require("./src/video");
const admin = require("./src/admin");

exports.startCheckout = payments.startCheckout;
exports.verifyPayment = payments.verifyPayment;
exports.paystackWebhook = payments.paystackWebhook;

exports.getPlaybackUrl = video.getPlaybackUrl;

exports.adminGrantAccess = admin.adminGrantAccess;
exports.adminRevokeAccess = admin.adminRevokeAccess;
exports.adminDeleteCourse = admin.adminDeleteCourse;
exports.adminDeleteLesson = admin.adminDeleteLesson;
