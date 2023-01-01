import * as dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { auth, db } from "./config.js";
import { signInWithEmailAndPassword } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFile } from "fs/promises";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";

const Port = process.env.PORT;

const json = JSON.parse(
  await readFile(new URL("./firbaseAdmin.json", import.meta.url))
);

const app = express();
app.use(express.json());
app.use(cors());
admin.initializeApp({
  credential: admin.credential.cert(json),
  storageBucket:"bfcai-7c34e.appspot.com"
});
let bucket = admin.storage().bucket()


/* Auth */

app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed in
      const user = userCredential.user;
      const token = user.stsTokenManager;
      res.json({ message: "success", token, user });
      // ...
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      res.json({ message: "Catch Error", errorCode, errorMessage });
    });
});

app.post("/verifyToken", (req, res) => {
  const { accessToken } = req.body;
  admin
    .auth()
    .verifyIdToken(accessToken)
    .then((decodedToken) => {
      const uid = decodedToken.uid;
      const token = jwt.sign(
        { user: decodedToken },
        process.env.tokenSignature
      );
      const detoken = jwt.verify(token, process.env.tokenSignature);
      console.log(token);
      res.json({ token, user: detoken });
      // ...
    })
    .catch((error) => {
      // Handle error
      res.json({ message: `Catch Error ${error}` });
    });
});

/* Auth */
/* User */

app.get("/users", async (req, res) => {
  const users = [];
  const querySnapshot = await getDocs(collection(db, "Users"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    users.push(doc.data());
  });
  res.status(200).json({ Message: "Success", users });
});
app.post("/user", async (req, res) => {
  const { id } = req.body;
  const docRef = doc(db, "Users", id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    console.log("Document data:", docSnap.data().fcm);
  } else {
    // doc.data() will be undefined in this case
    console.log("No such document!");
  }
});

/* User */

/* Get Verfivation */

app.post("/getVerfication", async (req, res) => {
  try {
    const { id } = req.body;
    let identity = {};
    const querySnapshot = await getDocs(
      collection(db, "Users", id, "CardImage")
    );
    console.log(querySnapshot.size);
    if (querySnapshot.size) {
      querySnapshot.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
        console.log(doc);
        identity = doc.data();
      });
      res.json({ Message: "Done", identity });
    } else {
      res.json({ Message: "User is Not Verified" });
    }
  } catch (error) {
    res.json("Catch Error", error);
  }
});

app.patch("/updateVerfication", async (req, res) => {
  try {
    const { id } = req.body;
    const { title, body } = req.body;
    const revRef = doc(db, "Users", id);
    const docSnap = await getDoc(revRef);
    const fcm = docSnap.data().fcm;
    /* Message */
    let message = {
      notification: {
        title: title,
        body: body,
      },
    };
    /* Message */

    if (docSnap.exists()) {
      if (
        docSnap.Verified == "Verified" ||
        docSnap.Verified == "Not Verified"
      ) {
        res.status(400).json(`User Can't Verified`);
      } else {
        await addDoc(collection(db, "Notifications"), {
          title: title,
          des: body,
          Date: new Date(),
          sendTo: id,
        });
        admin.messaging().sendToDevice(fcm, message);
        await updateDoc(revRef, {
          Verified: "Verified",
        })
          .then((docRef) => {
            res.status(200).json({ Message: "updated", docRef });
          })
          .catch((e) => {
            res.status(500).json(`Error:- ${e}`);
          });
      }
    } else {
      console.log("No such document!");
    }
  } catch (error) {
    res.status(500).json(`Error:- ${e}`);
  }
});

/* Get Verfivation */

/* FCM & Notification */

/* getallUserToken */

app.get("/getFcm", async (req, res) => {
  const fcm = [];
  const querySnapshot = await getDocs(collection(db, "Users"));
  querySnapshot.forEach((doc) => {
    fcm.push(doc.data().fcm);
  });
  res.status(200).json({ Message: "Success", fcm });
});

/* getallUserToken */

app.post("/subscribeToTopic", async (req, res) => {
  const { topic, token } = req.body;
  const fcm = [];
  const querySnapshot = await getDocs(collection(db, "Users"));
  querySnapshot.forEach((doc) => {
    fcm.push(doc.data().fcm);
  });
  admin
    .messaging()
    .subscribeToTopic(token, topic)
    .then((response) => {
      res.json(response);
    })
    .catch((error) => res.json(error));
});

app.post("/send", async (req, res) => {
  /* Message */
  const { title, body } = req.body;
  let message = {
    notification: {
      title: title,
      body: body,
    },
    topic: "/topics/all",
  };
  /* Message */
  await addDoc(collection(db, "Notifications"), {
    title: title,
    des: body,
    Date: new Date(),
    sendTo: "all",
  });
  admin
    .messaging()
    .send(message)
    .then(function (response) {
      res.json(response);
    })
    .catch(function (error) {
      res.json(error);
    });
});

/* FCM & Notification */

/* Review */

app.get("/getReviews", async (req, res) => {
  const compRev = [];
  const querySnapshot = await getDocs(collection(db, "CompanyReviews"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    compRev.push(doc.data());
  });
  res.status(200).json({ Message: "Success", compRev });
});

app.patch("/updateReviews", async (req, res) => {
  const { id } = req.body;
  const revRef = doc(db, "CompanyReviews", id);
  // Set the "capital" field of the city 'DC'
  await updateDoc(revRef, {
    reviewed: true,
  })
    .then((docRef) => {
      res.status(200).json({ Message: "updated", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
});

/* Review */
/* Discuss */

app.get("/getDiscus", async (req, res) => {
  const post = [];
  const querySnapshot = await getDocs(collection(db, "DiscussPosts"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    post.push(doc.data());
  });
  res.status(200).json({ Message: "Success", post });
});

app.delete("/deleteDiscuss/:id", async (req, res) => {
  const { id } = req.params;
  console.log(req.params);
  const disRef = doc(db, "DiscussPosts", id);
  await deleteDoc(disRef)
    .then((docRef) => {
      res.status(200).json({ Message: "Deleted", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
});

/* Discuss */
/* Jobs */
app.get("/getJobs", async (req, res) => {
  const Jobs = [];
  const querySnapshot = await getDocs(collection(db, "Jobs"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    Jobs.push(doc.data());
  });
  res.status(200).json({ Message: "Success", Jobs });
});

app.post("/addjobs", async (req, res) => {
  for (let i = 0; i < 50; i++) {
    const uuid = uuidv4();
    console.log(uuid);
    const data = {
      companyLocation: "https://www.google.com",
      companyWebsite: "https://www.google.com",
      companyPhoto:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/1200px-Google_%22G%22_Logo.svg.png",
      companyName: "Google",
      details: "aaa",
      jobCategory: "IT",
      jobType: "Part-time",
      numOfPosition: "5",
      requierments: "a,b,c",
      description: "aaaaaaaaaaaaaaaaaaa",
      reviewed: true,
      tags: ["freelance"],
      title: "test",
      Directlink: "",
      date: new Date(),
      userId: "VSIWs59klyLUOKooGYc7AsbTWrA2",
      postId: uuid,
    };
    await setDoc(doc(db, "Jobs", uuid), data);
  }
  res.json({ MSG: "Success" });
});

app.delete("/del", async (req, res) => {
  const arr = [
    "apybTzA0K1zEMs2FSa10",
    "bvwjxTwxt8AB2fNS5viu",
    "cQfnP1kN9jNbP58lhKab",
    "cqcSbp5H6BDp32yLWgVx",
    "dgWplc8XoLiMGEsO6AnC",
    "eNi5StlN0xQVWXrAYf8b",
    "eZR39fCWNnqb6fJsLC7S",
    "emoJ8vXa9rGpAuVUkJOw",
    "fvk7FbMeC8qj7i0zi5QI",
    "g8J1KPPasGOuZNMQlwfi",
    "gDnMte45rvxCoEKLx2qr",
    "gkAfTuS6ozFbE5WHaUjJ",
    "wq4cM9wyQtXayqmh8R6r",
    "wOoRYwe7EtDvZvzfK1pE",
    "vs7kEgHbiPj7dLotYFmx",
    "vqFNHD4h8tJX4STQrSc4",
    "vSptzCRnCHBF83Wx59KP",
    "tdZhzD4vlSWXlBjoikxh",
    "tXJwODNvnrch2BzaPFiu",
    "tSMsEs64RiHMYvYMyZER",
    "sb5jsbH8aQd5tBlo8RU4",
    "qYnKiMJvcdkNkmNnYE5U",
    "qSk4HPenKGffBd1aaz83",
    "qD4Kf7e6lcI5XDyygSln",
    "q6jTO6ukcXGbPz5mqg3n",
    "pyKpmrqovVeRoOsN1RfG",
    "x3EmBwqMmwq1LBElLBft",
    "xDUHgQekvdZymHbF29PQ",
    "yCOZGNh1AzaBuE9HVh0X",
    "yWVrHIZ4RUlYzc8IZeKw",
    "nMfZkEvI5a6n7XlymN28",
    "nyRw5xNSALCBp45ewQzh",
    "oa5IkySukTELKfF9EDdv",
    "pO6kpquF8N9DYoaMR9RI",
    "pWn8U3YzMOt4ks6sFZbL",
    "NKGqHpXwhcnkWSVyw8CX",
    "Nf9puMIiD7nZedrxNi1k",
  ];
  arr.forEach(async (i) => {
    const disRef = doc(db, "Jobs", i);
    await deleteDoc(disRef)
      .then((docRef) => {
        console.log("deleted");
      })
      .catch((e) => {
        console.log(error);
      });
  });
});
/* Jobs */
/* ChatWithAdmin */

app.get("/chats", async (req, res) => {
  let users = [];
  const querySnapshot = await getDocs(collection(db, "Admin"));
  if (querySnapshot.size) {
    querySnapshot.forEach(async(doc) => {
      users.push(doc.data())
      console.log(users);
    });
    res.json({ Message: "Done", users });
  }
});
app.get("/getMSG/:id", async (req, res) => {
  const {id} =req.params
  let msg = [];
  const querySnapshot = await getDocs(collection(db, "Admin", id, "messages"));
  if (querySnapshot.size) {
    querySnapshot.forEach((doc) => {
      console.log(doc.id, " => ", doc.data());
      msg.push(doc.data());
    });
    res.json({ Message: "Done", msg });
  }
});

app.post("/sendMSG/:id", async (req, res) => {
  const {id} =req.params
  const { msg } = req.body;
  const docRef = await addDoc(collection(db, "Admin", id, "messages"), {
    Admin: "WkYeODDVIFSuMDMVCaf2kpQmxHW2",
    createdAt: new Date(),
    fromType: "Admin",
    idUser: id,
    message: msg,
    type: "txt",
    adminname: "admin",
    username: "",
  });
  console.log("Document written with ID: ", docRef.id);
  res.json({ Message: "Done", docRef });
});
app.post("/file", async (req, res) => {
  const {filepath} = req.body
  const metadata = {
    metadata: { 
      // This line is very important. It's to create a download token.
      firebaseStorageDownloadTokens: uuidv4()
    },
    cacheControl: 'public, max-age=31536000',
  };
  await bucket.upload(filepath, {
    // Support for HTTP requests made with `Accept-Encoding: gzip`
    gzip: true,
    metadata: metadata,
  });
  console.log(`${filepath} uploaded.`);
});


/* ChatWithAdmin */

app.listen(Port, () => {
  console.log(`Server Is Running On Port ${Port}`);
});
