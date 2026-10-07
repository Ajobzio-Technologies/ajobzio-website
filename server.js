/* Entry point: load config, build the app, start listening. */
const { port } = require('./src/config/env');
const createApp = require('./src/app');

createApp().listen(port, () => console.log('Ajobzio running on http://localhost:' + port));
