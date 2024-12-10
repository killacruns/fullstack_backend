const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectId;
const path = require("path");
const fs = require("fs");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

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
app.put("/collection/:collectionName/:id", (req, res, next) => {
  const updatedSpaces = req.body.spaces;

  if (updatedSpaces < 0) {
    return res.status(400).json({ msg: "Spaces cannot be negative" });
  }

  req.collection.update(
    { _id: new ObjectID(req.params.id) },
    { $set: { spaces: updatedSpaces } },
    (e, results) => {
      if (e) {
        console.error("Error updating spaces:", e);
        return res.status(500).json({ msg: "Internal Server Error" });
      }

      res.send(
        results.modifiedCount === 1
          ? { msg: "Spaces updated successfully" }
          : { msg: "Lesson not found or no changes made" }
      );
    }
  );
});

// Enhanced Search Functionality
app.get("/search", async (req, res) => {
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
app.post("/collection/orders", async (req, res, next) => {
  const orderData = req.body; // Access the order information sent from the front-end
  const cart = orderData.cart;

  try {
      // First, save the order to the "orders" collection
      await db.collection("orders").insertOne(orderData);

      // Now, update the "spaces" for each course in the cart
      for (const course of cart) {
          console.log(`Updating course with ID: ${course._id}, Decreasing spaces by: ${course.quantity}`);
          // Update the spaces by subtracting the quantity of this course
          const result = await db.collection("courses").updateOne(
              { _id: new ObjectID(course._id) },
              { $inc: { spaces: -course.quantity } } // Decrease the spaces by the quantity of the course
          );
          if (result.matchedCount === 0) {
              console.error(`Course with _id ${course._id} not found`);
          }
      }

      res.status(201).json({ message: 'Order saved successfully!', order: orderData });
  } catch (err) {
      console.error("Error saving order or updating course spaces:", err);
      res.status(500).json({ message: "Failed to save order or update course spaces", error: err });
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
