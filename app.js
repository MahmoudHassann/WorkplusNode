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
    let data = docSnap.data()
    res.status(200).json({ Message: "Success",data });
    console.log("Document data:", docSnap.data().fcm);
  } else {
    // doc.data() will be undefined in this case
    console.log("No such document!");
  }
});

app.put("/updateProfile", async (req, res) => {
  const { id,Data} = req.body;
  const userRef = doc(db, "Users", id);
 
await updateDoc(userRef, {
  Name:Data.name,
  Description: Data.description,
  Image: Data.image,
  Phone: Data.phone,
  Tags: Data.tags,
})
  .then((docRef) => {
    res.status(200).json({ Message: "updated", docRef });
  })
  .catch((e) => {
    res.status(500).json(`Error:- ${e}`);
  });
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
      console.log(docSnap.data().Verified);
      if (
        docSnap.data().Verified == "Verified" ||
        docSnap.data().Verified == "Not Verified"
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

app.post("/addReviews", async (req, res) => {
  const { userid,title,text,tags} = req.body;
  const uid = uuidv4()
  let data = {
    title: title,
    description: text,
    likeNumber:0,
    viewNumber:0,
    commentNumber:0,
    date_of_post:new Date(),
    tags: tags,
    images:[""],
    reviewed: false,
    PostId:uid,
    userId: userid,
  }
  console.log(data);
  await setDoc(doc(db, "CompanyReviews", uid), data);
  res.status(200).json({ Message: "success"});
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

app.post("/addDiscus", async (req, res) => {
  const { text,userid,userName } = req.body;
  const docRef = await addDoc(collection(db, "DiscussPosts"), {
    text: text,
    name:userName,
    dateTime:new Date(),
    postImage: "",
    imageProfile: "",
    uId: userid,
  });
  console.log("Document written with ID: ", docRef.id);
  res.status(200).json({ Message: "success", docRef });
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

app.get("/getApplicants/:id", async (req, res) => {
  const {id} =req.params
  let applicants = [];
  const querySnapshot = await getDocs(collection(db, "Jobs", id, "Applicants"));
  if (querySnapshot.size) {
    querySnapshot.forEach((doc) => {
      console.log(doc.id, " => ", doc.data());
      applicants.push(doc.data());
    });
    res.json({ Message: "Done", applicants });
  }
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


/* Freelance */

app.get("/freelanceProjects", async (req, res) => {
  const FL_Projects = [];
  const querySnapshot = await getDocs(collection(db, "FreelanceProjects"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    FL_Projects.push(doc.data());
  });
  res.status(200).json({ Message: "Success", FL_Projects });
});

app.put("/updateProjects", async (req, res) => {
  const { id,value} = req.body;
  const revRef = doc(db, "FreelanceProjects", id);
  // Set the "capital" field of the city 'DC'
  await updateDoc(revRef, {
    reviewed: value, 
  })
    .then((docRef) => {
      res.status(200).json({ Message: "updated", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
});




app.get("/getCategories", async (req, res) => {
  const ctg = [];
  const querySnapshot = await getDocs(collection(db, "Category"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    ctg.push(doc.data());
  });
  res.status(200).json({ Message: "Success", ctg });
});

app.post("/addCategory", async (req, res) => {
  const { title } = req.body;
  const docRef = await addDoc(collection(db, "Category"), {
    title: title,
    urlPhoto: ""
  });
  console.log("Document written with ID: ", docRef.id);
  res.status(200).json({ Message: "success", docRef });
});



app.patch("/updateCategory", async (req, res) => {
  const { id,title } = req.body;
  const revRef = doc(db, "Category", id);
  // Set the "capital" field of the city 'DC'
  await updateDoc(revRef, {
    title: title, 
  })
    .then((docRef) => {
      res.status(200).json({ Message: "updated", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
});


app.delete("/deleteCategory/:id", async (req, res) => {
  const { id } = req.params;
  console.log(req.params);
  const disRef = doc(db, "Category", id);
  await deleteDoc(disRef)
    .then((docRef) => {
      res.status(200).json({ Message: "Deleted", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
}); 

app.get("/getSubCategories", async (req, res) => {
  const sctg = [];
  const querySnapshot = await getDocs(collection(db, "SubCategory"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    sctg.push(doc.data());
  });
  res.status(200).json({ Message: "Success", sctg });
});


app.post("/addSubCategory", async (req, res) => {
  const { category,subcategory } = req.body;
  const docRef = await addDoc(collection(db, "SubCategory"), {
    title: category,
    subtitle:subcategory,
    urlPhoto: ""
  });
  console.log("Document written with ID: ", docRef.id);
  res.status(200).json({ Message: "success", docRef });
});



app.patch("/updateSubCategory", async (req, res) => {
  const { id,category} = req.body;
  const revRef = doc(db, "SubCategory", id);
    await updateDoc(revRef, {
      title: category,
    }).then((docRef) => {
      res.status(200).json({ Message: "updated", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
});


app.delete("/deleteSubCategory/:id", async (req, res) => {
  const { id } = req.params;
  console.log(req.params);
  const disRef = doc(db, "SubCategory", id);
  await deleteDoc(disRef)
    .then((docRef) => {
      res.status(200).json({ Message: "Deleted", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
}); 


/* WORKS */

/* app.get("/myworks", async (req, res) => {
  const FL_MyWorks = [];
  const querySnapshot = await getDocs(collection(db, "MyWorks"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    FL_MyWorks.push(doc.data());
  });
  res.status(200).json({ Message: "Success", FL_MyWorks });
}); */

app.post("/userWork", async (req, res) => {
  const { id } = req.body;
  const FL_MyWorks = [];
  const querySnapshot = await getDocs(collection(db, "MyWorks"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    if(doc.data().userId == id)
      FL_MyWorks.push(doc.data());
    else
    console.log("Error");
  });
  res.status(200).json({ Message: "Success", FL_MyWorks });
});


app.post("/addWork", async (req, res) => {
  const { id,title,completionDate,description,directLink,filelink,imagelink,tags} = req.body;
  const uid = uuidv4()
  let data = {
    title: title,
    completionDate:completionDate,
    dateOfAdd: new Date(),
    description:description,
    directLink:directLink,
    file:filelink,
    image:imagelink,
    tags:tags,
    userId:id,
    myWorkId:uid
  }
  console.log(data);
  await setDoc(doc(db, "MyWorks", uid), data);
  res.status(200).json({ Message: "success"});
});



app.patch("/updateWork", async (req, res) => {
  const { id,title,completionDate,description,directLink,filelink,imagelink,tags} = req.body;
  const revRef = doc(db, "MyWorks", id);
    await updateDoc(revRef, {
      title: title,
      completionDate:completionDate,
      description:description,
      directLink:directLink,
      file:filelink,
      image:imagelink,
      tags:tags,
    }).then((docRef) => {
      res.status(200).json({ Message: "updated", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
});

app.delete("/deleteWork/:id", async (req, res) => {
  const { id } = req.params;
  console.log(req.params);
  const disRef = doc(db, "MyWorks", id);
  await deleteDoc(disRef)
    .then((docRef) => {
      res.status(200).json({ Message: "Deleted", docRef });
    })
    .catch((e) => {
      res.status(500).json(`Error:- ${e}`);
    });
}); 

/* WORKS */

app.get("/rates", async (req, res) => {
  const rates = [];
  const querySnapshot = await getDocs(collection(db, "Rates"));
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    rates.push(doc.data());
  });
  res.status(200).json({ Message: "Success", rates });
});