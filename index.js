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
    origin: ["http://localhost:5173", "https://dev-forum-by-ubaid.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ubaid-database.njfi7n5.mongodb.net/?retryWrites=true&w=majority&appName=Ubaid-Database`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) return res.status(401).send({ message: "unauthorized access" });
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const dataBase = client.db("Forum");
    const usersCollection = dataBase.collection("users");
    const postsCollection = dataBase.collection("posts");
    const announcementCollection = dataBase.collection("announcement");
    const tagCollection = dataBase.collection("tags");
    const commentsCollection = dataBase.collection("comments");
    const reportsCollection = dataBase.collection("reports");
    // ? jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .send({ success: true });
    });
    // ? deleted token on logout
    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });
      res.send({ success: true, message: "Logged out successfully" });
    });
    //? manage users
    app.get("/users", verifyToken, async (req, res) => {
      const search = req.query.search;
      const page = req.query.page || 0;
      let query = {};
      if (search) {
        query = { name: { $regex: search, $options: "i" } };
      }
      const users = await usersCollection
        .find(query)
        .skip(page * 5)
        .limit(5)
        .toArray();
      const count = await usersCollection.countDocuments(query);
      res.send({ users, count });
    });
    //? get all reports
    app.get("/reports", verifyToken, async (req, res) => {
      const page = req.query.page;
      const reports = await reportsCollection
        .find()
        .skip(page * 5)
        .limit(5)
        .toArray();
      const count = await reportsCollection.countDocuments();
      res.send({ reports, count });
    });
    // ? get posts by search
    app.get("/getPosts", async (req, res) => {
      try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 0;
        const size = 5;
        const sortBy = req.query.sortBy || "latest";

        let matchQuery = {};
        if (search) {
          matchQuery = { tag: { $regex: search, $options: "i" } };
        }

        let pipeline = [{ $match: matchQuery }];

        if (sortBy === "popularity") {
          pipeline.push({
            $addFields: {
              voteDifference: { $subtract: ["$UpVote", "$DownVote"] },
            },
          });
          pipeline.push({ $sort: { voteDifference: -1 } });
        } else {
          pipeline.push({ $sort: { _id: -1 } });
        }

        pipeline.push({ $skip: page * size });
        pipeline.push({ $limit: size });

        const posts = await postsCollection.aggregate(pipeline).toArray();
        const count = await postsCollection.countDocuments(matchQuery);

        res.send({ posts, count });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    //? get posts
    app.get("/posts", async (req, res) => {
      const tag = req.query.tag
      let users;
      if(tag){
        users = await postsCollection.find({ tag }).toArray();
      } else {
        users = await postsCollection.find().toArray();
      }
      res.send(users);
    });
    //? get all users for admin
    app.get("/allUsers", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    //? get total comments
    app.get("/allComments", verifyToken, async (req, res) => {
      const users = await commentsCollection.find().toArray();
      res.send(users);
    });
    //? get posts by id
    app.get("/post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsCollection.findOne(query);
      res.send(result);
    });
    //? get tags
    app.get("/tags", async (req, res) => {
      result = await tagCollection.find().toArray();
      res.send(result);
    });
    //? get all comment for a post
    app.get("/comments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const query = { postId: postId };
      const comments = await commentsCollection
        .find(query)
        .sort({ createdAt: 1 })
        .toArray();
      res.send(comments);
    });
    //? get announcement
    app.get("/announcement", async (req, res) => {
      const users = await announcementCollection.find().toArray();
      res.send(users);
    });
    //? get user by email
    app.get("/users/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    app.get("/role/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const { role } = await usersCollection.findOne(query);
      res.send(role);
    });
    //? get posts via email
    app.get("/posts/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const page = req.query.page;
      const result = await postsCollection
        .find(query)
        .skip(page * 5)
        .limit(5)
        .toArray();
      const count = await postsCollection.countDocuments(query);
      res.send({ result, count });
    });
    //? get recent posts for user
    app.get("/profile/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const result = await postsCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });
    app.get("/bannerTags", async (req, res) => {
      const result = await tagCollection
        .find()
        .sort({ _id: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });
    //? create post
    app.post("/add-post", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await postsCollection.insertOne(data);
      res.send(result);
    });
    //? tags post
    app.post("/tags", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await tagCollection.insertOne(data);
      res.send(result);
    });
    //? make announcement
    app.post("/announcement", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await announcementCollection.insertOne(data);
      res.send(result);
    });
    //? make comments
    app.post("/comments", verifyToken, async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      data.isReported = false;
      data.reportedAt = null;
      data.feedback = "";
      const result = await commentsCollection.insertOne(data);
      res.send(result);
    });
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).send({ message: "Invalid payment amount" });
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        payment_method_types: ["card"],
        metadata: {
          userEmail: req.decoded.email,
        },
      });

      res.send({ clientSecret: paymentIntent.client_secret });
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
    app.patch("/makeAdmin/:id", verifyToken, async (req, res) => {
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
    //? become member
    app.patch("/becomeMember/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const updateDoc = {
        $set: {
          role: "member",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // ? report comment
    app.patch("/reportComment/:id", verifyToken, async (req, res) => {
      const commentId = req.params.id;
      const { feedback, userEmail } = req.body;

      try {
        const query = { _id: new ObjectId(commentId) };
        const comment = await commentsCollection.findOne(query);

        if (!comment) {
          return res.status(404).send({ message: "Comment not found." });
        }

        if (comment.reportedBy && comment.reportedBy.includes(userEmail)) {
          return res
            .status(400)
            .send({ message: "You have already reported this comment." });
        }

        const updateDoc = {
          $set: {
            isReported: true,
            feedback: feedback,
            reportedAt: new Date(),
          },
          $addToSet: {
            reportedBy: userEmail,
          },
        };
        await commentsCollection.updateOne(query, updateDoc);
        const reportData = {
          commentId: commentId,
          postId: comment.postId || null,
          commenterEmail: comment.commenterEmail || null,
          commenterName: comment.commenterName || null,
          reporterEmail: userEmail,
          feedback: feedback,
          reportedAt: new Date(),
          commentText: comment.comment || "",
          status: "Pending",
        };
        await reportsCollection.insertOne(reportData);

        res.send({
          message: "Reported successfully.",
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          message: "Something went wrong while reporting the comment.",
        });
      }
    });
    //? 🚩 Admin delete reported comment
    app.delete(
      "/deleteReportedComment/:reportId",
      verifyToken,
      async (req, res) => {
        const reportId = req.params.reportId;
        const reportQuery = { _id: new ObjectId(reportId) };
        const report = await reportsCollection.findOne(reportQuery);
        const commentId = report.commentId;
        const commentQuery = { _id: new ObjectId(commentId) };
        const deleteResult = await commentsCollection.deleteOne(commentQuery);
        const updateReport = await reportsCollection.updateOne(reportQuery, {
          $set: {
            status: "Resolved",
            resolvedAt: new Date(),
          },
        });
        res.send(updateReport);
      }
    );
    // ? upvote
    app.patch("/like/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          UpVote: 1,
        },
      };
      const result = await postsCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // ? downvote
    app.patch("/dislike/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          DownVote: 1,
        },
      };
      const result = await postsCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // ? cancel admin
    app.patch("/cancelAdmin/:id", verifyToken, async (req, res) => {
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
    app.delete("/post/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsCollection.deleteOne(query);
      res.send(result);
    });
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
