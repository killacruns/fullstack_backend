const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectId;
const path = require("path");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 8000;
const cors = require("cors");


app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  next();
});

// Logger Middleware
function logger(req, res, next) {
  console.log(
    `Request Method: ${req.method}, Request URL: ${
      req.url
    } - Date: ${new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Dubai",
    })}`
  );
  next();
}
app.use(logger);

let db;

// MongoDB Connection
MongoClient.connect(
  "mongodb+srv://mugoasman:Salmagluta@cluster0.26e8e.mongodb.net/",
  { useUnifiedTopology: true },
  (err, client) => {
    if (err) {
      console.error("Failed to connect to MongoDB", err);
      process.exit(1);
    }
    db = client.db("Webstore");
    console.log("Connected to MongoDB");
  }
);

// Root Route
app.get("/", (req, res) => {
  res.send("Select a collection, e.g., /collection/messages");
});

// Middleware to Get Collection
app.param("collectionName", (req, res, next, collectionName) => {
  req.collection = db.collection(collectionName);
  next();
});

// Retrieve All Documents
app.get("/collection/:collectionName", (req, res, next) => {
  req.collection.find({}).toArray((e, results) => {
    if (e) return next(e);
    res.send(results);
  });
});

// Insert a Document
app.post("/collection/:collectionName", (req, res, next) => {
  req.collection.insertOne(req.body, (e, results) => {
    if (e) return next(e);
    res.send(results.ops);
  });
});

// Get Document by ID
app.get("/collection/:collectionName/:id", (req, res, next) => {
  req.collection.findOne({ _id: new ObjectID(req.params.id) }, (e, result) => {
    if (e) return next(e);
    res.send(result);
  });
});

// Update a Document
app.put("/collection/:collectionName/:id", (req, res, next) => {
  req.collection.updateOne(
    { _id: new ObjectID(req.params.id) },
    { $set: req.body },
    (e, results) => {
      if (e) return next(e);
      res.send(results.modifiedCount === 1 ? { msg: "success" } : { msg: "error" });
    }
  );
});

// Handle Order Submission
app.post("/collection/products", (req, res, next) => {
  req.collection.insertOne(req.body, (e, result) => {
    if (e) return next(e);
    res.status(201).send({ message: "Order placed successfully", orderId: result.insertedId });
  });
});



// Serve Static Files
app.use((req, res, next) => {
  const filePath = path.join(__dirname, "static", req.url);
  fs.stat(filePath, (err, fileInfo) => {
    if (err) {
      next();
      return;
    }
    if (fileInfo.isFile()) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });
});

// 404 Handler for Non-Existent Routes
app.use((req, res) => {
  res.status(404).send("Route not found");
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start Server
app.listen(port, () => {
  console.log(`Express.js server running at http://localhost:${port}`);
});
