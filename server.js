const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectId;
const path = require("path");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
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
    `Request Method: ${req.method}, Request URL: ${req.url} - Date: ${new Date().toLocaleString("en-GB", {
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
  res.send("Select a collection, e.g., /collection/products");
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

// Update Available Spaces for Lessons
app.put("/collection/lessons/:id", (req, res, next) => {
  const updatedSpaces = req.body.spaces;

  if (updatedSpaces < 0) {
    return res.status(400).json({ msg: "Spaces cannot be negative" });
  }

  req.collection.updateOne(
    { _id: new ObjectID(req.params.id) },
    { $set: { spaces: updatedSpaces } },
    (e, results) => {
      if (e) return next(e);

      res.send(
        results.modifiedCount === 1
          ? { msg: "Spaces updated successfully" }
          : { msg: "Lesson not found or no changes made" }
      );
    }
  );
});

// Enhanced Search Functionality
app.get("/api/search", async (req, res) => {
  const searchTerm = req.query.q?.trim();
  const lessonsCollection = db.collection("lessons");

  try {
    if (!searchTerm) {
      const allLessons = await lessonsCollection.find().toArray();
      return res.status(200).json(allLessons);
    }

    const isNumeric = !isNaN(Number(searchTerm));

    const lessons = await lessonsCollection.find({
      $or: [
        { subject: { $regex: searchTerm, $options: "i" } },
        { location: { $regex: searchTerm, $options: "i" } },
        ...(isNumeric
          ? [
              { price: { $eq: Number(searchTerm) } },
              { spaces: { $eq: Number(searchTerm) } },
            ]
          : []),
      ],
    }).toArray();

    res.status(200).json(lessons);
  } catch (err) {
    console.error("Error searching lessons:", err);
    res.status(500).send("Error searching lessons");
  }
});

// Submit Order
app.post('/api/orders', async (req, res) => {
  const { customer, items, totalPrice } = req.body;

  if (!customer || !items || items.length === 0 || !totalPrice) {
    return res.status(400).json({ message: 'Invalid order data' });
  }

  try {
    // Insert the order into the "orders" collection
    const orderCollection = db.collection('orders');
    const result = await orderCollection.insertOne({
      customer,
      items,
      totalPrice,
      date: new Date(),
    });

    res.status(201).json({ message: 'Order placed successfully', orderId: result.insertedId });
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ message: 'Error placing order' });
  }
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
