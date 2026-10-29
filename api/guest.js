// Isolated Vercel function; never imports the authenticated Expo application.
module.exports = require('../server/guest/handler.cjs').createHandler();
