const { serve } = require('@hono/node-server');
const app = require('./app');

const port = 3000;
console.log(`Serever running at http://localhost:${port}/`);
serve({
    fetch: app.fetch,
    port,
});