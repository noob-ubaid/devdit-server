const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ubaid-database.njfi7n5.mongodb.net/?retryWrites=true&w=majority&appName=Ubaid-Database`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const dataBase = client.db("Forum");
    const usersCollection = dataBase.collection("users");
    const postsCollection = dataBase.collection("posts");
    const announcementCollection = dataBase.collection("announcement");
    const tagCollection = dataBase.collection("tags");
    const commentsCollection = dataBase.collection("comments");
    //? manage users
    app.get("/users", async (req, res) => {
      const search = req.query.search;
      let query = {};
      if (search) {
        query = { name: { $regex: search, $options: "i" } };
      }
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    //? get posts
    app.get("/posts", async (req, res) => {
      const users = await postsCollection.find().toArray();
      res.send(users);
    });
    app.get("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsCollection.findOne(query);
      res.send(result);
    });
    app.get("/postsCount", async (req, res) => {
      const count = await postsCollection.estimatedDocumentCount();
      res.send(count);
    });
    //? get posts for pagination
    app.get("/pagination", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = 5;
      const result = await postsCollection
        .find()
        .sort({ _id: -1 })
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    //? get tags
    app.get("/tags", async (req, res) => {
      const result = await tagCollection.find().toArray();
      res.send(result);
    });
    //? get announcement
    app.get("/announcement", async (req, res) => {
      const users = await announcementCollection.find().toArray();
      res.send(users);
    });
    //? get user by email
    app.get("/users/:email", async (req, res) => {
      const query = { email: req.params.email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    //? get posts via email
    app.get("/posts/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await postsCollection.find(query).toArray();
      res.send(result);
    });
    //? get recents post for user
    app.get("/profile/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await postsCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });
    //? create post
    app.post("/add-post", async (req, res) => {
      const data = req.body;
      const result = await postsCollection.insertOne(data);
      res.send(result);
    });
    //? tags post
    app.post("/tags", async (req, res) => {
      const data = req.body;
      const result = await tagCollection.insertOne(data);
      res.send(result);
    });
    //? make announcement
    app.post("/announcement", async (req, res) => {
      const data = req.body;
      const result = await announcementCollection.insertOne(data);
      res.send(result);
    });

    //? make comments
    app.post("/comments", async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      data.isReported = false;
      data.reportedAt = null;
      data.feedback = "";
      const result = await commentsCollection.insertOne(data);
      res.send(result);
    });
    //? user store in the db
    app.post("/user", async (req, res) => {
      const data = req.body;
      const query = { email: data.email };
      const alreadyExists = await usersCollection.findOne(query);
      if (!!alreadyExists) {
        const result = await usersCollection.updateOne(query, {
          $set: { lastLoggedIn: new Date().toISOString() },
        });
        return res.send(result);
      }
      const result = await usersCollection.insertOne(data);
      res.send(result);
    });
    //? make admin
    app.patch("/makeAdmin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // ? cancel admin
    app.patch("/cancelAdmin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "user",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    //? delete post
    app.delete("/post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsCollection.deleteOne(query);
      res.send(result);
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
