// Importing necessary modules and dependencies
import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import connectToMongo from "./db.js";
import session from "express-session";
import MongoDBStoreImport from "connect-mongodb-session";
import socket from "./Socket/Socket.js";
import authRouter from "./routes/Auth.js";
import postRouter from "./routes/Post.js";
import AdminRouter from "./routes/Admin.js";

// Setting up MongoDB session store
const MongoDBStore = MongoDBStoreImport(session);
const store = new MongoDBStore({
  uri: process.env.URI,
  collection: "sessions",
  ttl: 2592000, // 30 days,
});

// Catch errors for MongoDB session store
store.on("error", function (error) {
  console.log(error);
});

// Configuring environment variables
dotenv.config();

// Creating an Express application
const app = express();

// Starting the server
const httpServer = createServer(app);

// Configuring session middleware
app.use(
  session({
    secret: process.env.SESSIONSECRET,
    cookie: {
      maxAge: 2592000000, // 30 days,
    },
    store: store,
    resave: false,
    saveUninitialized: false,
  })
);

// Setting up Socket.IO with CORS configuration
const io = new Server(httpServer, {
  cors: {
    // origin: ["http://localhost:5173"],
    origin: [process.env.CLIENT_HOST],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Configuring Express application
const port = process.env.PORT || 8080;
app.disable("x-powered-by");
app.use(express.json());
app.use(
  cors({
    // origin: ["http://localhost:5173"],
    origin: [process.env.CLIENT_HOST],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Handling Socket.IO connections
socket(io);
// Connecting to MongoDB
connectToMongo();

// Serving static files from the 'public' directory
app.use(express.static("public"));

// Setting up authentication routes
app.use("/api/auth", authRouter);
app.use("/api/post", postRouter);
app.use("/api/admin", AdminRouter);

// Handling root endpoint
app.get("/", (req, res) => {
  // res.send({ id: JSON.stringify(req.sessionID), data: req.session });
  res.redirect(process.env.CLIENT_HOST);
});
app.get("/helloworld", (req, res) => {
  const name = req.session.name ? req.session.name : null;
  req.session.name = "vaibhav";
  res.send({ id: JSON.stringify(req.sessionID), data: req.session, name });
  // res.redirect(process.env.CLIENT_HOST);
});

httpServer.listen(port, () => {
  console.log(`Server listening on\n http://localhost:${port}`);
});
