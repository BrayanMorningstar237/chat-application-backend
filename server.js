require("dotenv").config();
const cors = require('cors');
const app = require("./src/app");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./src/config/db");

connectDB();

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});
app.set('io', io);

require("./src/sockets/socket")(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
