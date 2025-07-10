const { MongoClient, ServerApiVersion } = require("mongodb");
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
    app.get("/users/:email", async (req, res) => {
      const query = { email: req.params.email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    app.get("/posts/:email", async (req, res) => {
      const query = {email : req.params.email}
      const result = await postsCollection.find(query).toArray();
      res.send(result);
    })
    app.get("/profile/:email", async (req, res) => {
      const query = {email : req.params.email}
      const result = await postsCollection.find(query).limit(3).toArray();
      res.send(result);
    })



    app.post("/add-post", async (req, res) => {
      const data = req.body;
      const result = await postsCollection.insertOne(data);
      res.send(result);
    })
   app.get("/profile/:email", async (req, res) => {
      const query = {email : req.params.email}
      const result = await postsCollection.find(query).limit(3).toArray();
      res.send(result);
    })


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
