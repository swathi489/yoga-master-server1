const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { FirebaseAppProvider } = require('reactfire');
const firebaseConfig = require('./firebaseConfig'); 

const corsOptions ={
    origin: 'https://yoga-master-final-ashen.vercel.app', 
    credentials: true,
    optionSuccessStatus: 200
};

app.use(cors(corsOptions)); // Use cors middleware with the specified options

const port = process.env.PORT || 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Firebase initialization
const startFirebase = async () => {
    try {
        await FirebaseAppProvider(firebaseConfig);
        console.log("Firebase initialized successfully");
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
};
 
    const verifyJWT = (req, res, next) => {
    try {
        const authorization = req.headers.authorization;
        if (!authorization || !authorization.startsWith('Bearer ')) {
            return res.status(401).send({ error: true, message: 'Unauthorized access. Token missing or invalid.' });
        }

        const token = authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).send({ error: true, message: 'Forbidden user or token has expired' });
            }
            req.decoded = decoded;
            next();
        });
    } catch (error) {
        console.error("Error verifying JWT:", error);
        res.status(500).send("Internal Server Error");
    }
};


    // MongoDB connection
    const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@yogamaster.ilptnz9.mongodb.net/?retryWrites=true&w=majority&appName=yogaMaster`;
    const client = new MongoClient(uri,{
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });



    // Connect to MongoDB and start the Express server
    async function startServer() {
        try {
            // await client.connect();
            console.log("Connected to MongoDB");
            const database = client.db("yoga-master");
            const classesCollection = database.collection("classes"); // Initialize classesCollection globally
            const cartCollection = database.collection("cart"); // Initialize cartCollection globally
            const userCollection = database.collection("users"); // Initialize userCollection globally
            const paymentCollection = database.collection("payment");
            const enrolledCollection = database.collection("enrolled");
            const appliedCollection = database.collection("applied");
            client.connect();

            const verifyAdmin = async (req, res, next) => {
    try {
        // Check if decoded token is available
        if (!req.decoded || !req.decoded.email) {
            return res.status(401).send({ error: true, message: 'Unauthorized access. Token missing or invalid.' });
        }

        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);

        if (!user || user.role !== 'admin') {
            return res.status(401).send({ error: true, message: 'Unauthorized access. User is not an admin.' });
        }

        // User is an admin, proceed to the next middleware
        next();
    } catch (error) {
        console.error("Error verifying admin:", error);
        res.status(500).send("Internal Server Error");
    }
};

// Middleware function to verify JWT


    // Middleware function to verify instructor or admin
    const verifyInstructor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        if (user.role === 'instructor' || (user.role === 'admin')) {
            next();
        } else {
            return res.status(401).send({ error: true, message: 'Unauthorized access' });
        }
    };


    // Create a new user
    app.post('/new-user',  async (req, res) => {
        try {
            // Extract new user data from request body
            const newUser = req.body;

            // Insert the new user data into userCollection
            const result = await userCollection.insertOne(newUser);

            // Send the result as response
            res.send(result);
        } catch (error) {
            console.error("Error creating new user:", error);
            res.status(500).send("Internal Server Error");
        }
    });
    app.post('/api/set-token', (req, res) => {
        try {
            // Extract user data from request body
            const user = req.body;

            // Create a JWT token with user data and send it as response
            const token = jwt.sign(user, process.env.ACCESS_SECRET, { expiresIn: '24h' });
            res.send({ token });
        } catch (error) {
            console.error("Error setting token:", error);
            res.status(500).json("Internal Server Error");
        }
    });
    app.get('/users',async (req, res) => {
        try {
            const users = await userCollection.find({}).toArray();
            res.send(users);
        } catch (error) {
            console.error("Error fetching users:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Get user by ID
    app.get('/users/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const user = await userCollection.findOne(query);
            res.send(user);
        } catch (error) {
            console.error("Error fetching user by ID:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Get user by email
    app.get('/user/:email', verifyJWT, async (req, res) => {
        try {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        } catch (error) {
            console.error("Error fetching user by email:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Delete a user
    app.delete('/delete-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send("Internal Server Error");
    }
});

    // Update user
    app.put('/update-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const updatedUser = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        // Construct the update document based on the updatedUser data
        const updateDoc = {
            $set: {
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.option,
                address: updatedUser.address,
                phone: updatedUser.phone,
                about: updatedUser.about,
                photoUrl: updatedUser.photoUrl,
                skills: updatedUser.skills ? updatedUser.skills : null,
            }
        };
        const result = await userCollection.updateOne(filter, updateDoc, options);
        res.send(result);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send("Internal Server Error");
    }
});



app.post('/new-class', verifyJWT, verifyInstructor, async (req, res) => {
  try {
    const newClass = req.body;
    
    // Ensure availableSeats is an integer
    newClass.availableSeats = parseInt(newClass.availableSeats);
    
    // Check if availableSeats is a valid number
    if (isNaN(newClass.availableSeats)) {
      return res.status(400).send({ message: 'Invalid number of available seats' });
    }

    // Insert the new class into the collection
    const result = await classesCollection.insertOne(newClass);
    
    // Send the result back to the client
    res.send(result);
  } catch (error) {
    console.error('Error inserting new class:', error);

    // Send a generic error message to the client
    res.status(500).send({ message: 'An error occurred while creating the class' });
  }
});
     

    // GET request to retrieve classes with status 'approved'
    app.get('/classes',async (req, res) => {
        try {
            const query = { status: 'approved' };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error retrieving classes:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // GET request to retrieve classes by email
    app.get('/classes/:email',verifyJWT,verifyInstructor,async (req, res) => {
        try {
            const email = req.params.email;
            const query = { instructorEmail: email };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error retrieving classes by email:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // GET request to retrieve all classes for management
    app.get('/classes-manage', async (req, res) => {
        try {
            const result = await classesCollection.find().toArray();
            res.send(result);
        } catch (error) {
            console.error("Error retrieving classes for management:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // GET request to retrieve a class by its ID
    app.get('/class/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCollection.findOne(query);
            res.send(result);
        } catch (error) {
            console.error("Error retrieving class by ID:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // PUT request to update a class by its ID
    app.put('/update-class/:id',verifyJWT,verifyInstructor, async (req, res) => {
        try {
            const id = req.params.id;
            const updateClass = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: updateClass.name,
                    description: updateClass.description,
                    price: updateClass.price,
                    availableSeats: parseInt(updateClass.availableSeats),
                    videoLink: updateClass.videoLink,
                    status: 'pending',
                }
            };
            const result = await classesCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        } catch (error) {
            console.error("Error updating class:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Patch request to change status and reason for a class by ID
    app.patch('/change-status/:id',  verifyJWT,verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.body.status;
        const reason = req.body.reason;

        // Validate that both status and reason are provided
        if (!status || !reason) {
            return res.status(400).json({ error: "Status and reason are required." });
        }

        // Add more specific validation if needed

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                status: status,
                reason: reason,
            },
        };

        const result = await classesCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 1) {
            // Send a success response
            res.json({ message: "Class status updated successfully." });
        } else {
            // If no document was modified, class with given ID was not found
            res.status(404).json({ error: "Class not found." });
        }
    } catch (error) {
        console.error("Error updating class status:", error);
        res.status(500).send("Internal Server Error");
    }
});




    // Assuming cartCollection and classesCollection are initialized properly

    app.post('/add-to-cart',verifyJWT,async (req, res) => {
        try {
            const newCartItem = req.body;

            const result = await cartCollection.insertOne(newCartItem);
            res.send(result);
        } catch (error) {
            console.error("Error adding item to cart:", error);
            res.status(500).send("Internal Server Error");
        }
    });


    // GET request to retrieve cart item by class ID and user email
    app.get('/cart-item/:id/:email', verifyJWT, async (req, res) => {
        try {
            const id = req.params.id;
            const email = req.params.email;

            const query = { classId: id, userMail: email };
            const projection = { classId: 1 };

            const result = await cartCollection.findOne(query, { projection: projection });
            res.send(result);
        } catch (error) {
            console.error("Error retrieving cart item:", error);
            res.status(500).send("Internal Server Error");
        }
    });


    app.get('/cart/:email', verifyJWT, async (req, res) => {
        try {
            const email = req.params.email;

            const query = { userMail: email };
            const projection = { classId: 1 };

            const carts = await cartCollection.find(query, { projection: projection }).toArray();
            const classIds = carts.map(cart => new ObjectId(cart.classId));
            const query2 = { _id: { $in: classIds } };

            const result = await classesCollection.find(query2).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error retrieving user's cart items:", error);
            res.status(500).send("Internal Server Error");
        }
    });


    // DELETE request to delete an item from the cart
    app.delete('/delete-cart-item/:id',verifyJWT,async (req, res) => {
        try {
            const id = req.params.id;
            const query = { classId: id };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        } catch (error) {
            console.error("Error deleting item from cart:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Payment routes

    // POST request to create a payment intent
    app.post("/create-payment-intent", async (req, res) => {
        try {
            const {price} = req.body;
            const amount = parseInt(price) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        } catch (error) {
            console.error("Error creating payment intent:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // POST request to post payment info to the database
    app.post("/payment-info",verifyJWT, async (req, res) => {
        try {
            const paymentInfo = req.body;
    const classesId = paymentInfo.classesId;
            const userEmail = paymentInfo.userEmail;
            const singleClassId = req.query.classId;
            let query;

            // Construct the query based on singleClassId and userEmail
            if (singleClassId) {
                query = { classId: singleClassId, userMail: userEmail };
            } else {
                query = { classId: { $in: classesId } };
            }

            // Query to retrieve class details
            const classesQuery = { _id: { $in: classesId.map(id => new ObjectId(id)) } };
            const classes = await classesCollection.find(classesQuery).toArray();

            // Prepare data for new enrolled entry
            const newEnrolledData = {
                userEmail: userEmail,
                classesId: classesId.map(id => new ObjectId(id)),
                transactionId: paymentInfo.transactionId,
            };

            // Prepare update operation for updating class documents
            const updatedDoc = {
                $set: {
                    totalEnrolled: classes.reduce((total, current) => total + current.totalEnrolled, 0) + 1 || 0,
                    availableSeats: classes.reduce((total, current) => total + current.availableSeats, 0) - 1 || 0,
                }
            };

            // Update class documents
            const updatedResult = await classesCollection.updateMany(classesQuery, updatedDoc, { upsert: true });

            // Insert new enrolled entry
            const enrolledResult = await enrolledCollection.insertOne(newEnrolledData);

            // Delete items from cart
            const deletedResult = await cartCollection.deleteMany(query);

            // Insert payment information
            const paymentResult = await paymentCollection.insertOne(paymentInfo);

            // Send response
            res.send({ paymentResult, deletedResult, enrolledResult, updatedResult });
        } catch (error) {
            console.error("Error posting payment info:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Payment history routes

    // GET request to retrieve payment history by user email
    app.get('/payment-history/:id/:email', async (req, res) => {
        try {
            const email = req.params.email;
            const query = { userEmail: email };
            const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error retrieving payment history:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // GET request to retrieve the length of payment history by user email
    app.get('/payment-history-length/:email', async (req, res) => {
        try {
            const email = req.params.email;
            const query = { userEmail: email };
            const total = await paymentCollection.countDocuments(query);
            res.send({ total });
        } catch (error) {
            console.error("Error retrieving payment history length:", error);
            res.status(500).send("Internal Server Error");
        }
    });
    //enrollment routes

    // Route to retrieve popular classes
    app.get('/popular_classes', async (req, res) => {
        try {
            // Query to find popular classes sorted by totalEnrolled in descending order and limited to 6 classes
            const result = await classesCollection.find().sort({ totalEnrolled: -1 }).limit(6).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error retrieving popular classes:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Route to retrieve popular instructors
    app.get('/popular-instructors', async (req, res) => {
        try {
            // Pipeline for aggregation to find popular instructors based on totalEnrolled
            const pipeline = [
                {
                    $group: {
                        _id: "$instructorEmail",
                        totalEnrolled: { $sum: "$totalEnrolled" },
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "email",
                        as: "instructor"
                    }
                },
                {
                        $match:{
                            "instructor.role":"instructor",
                        }
                    },
                {
                    $project: {
                        _id: 0,
                        instructor: {
                            $arrayElemAt: ["$instructor", 0]
                        },
                        totalEnrolled: 1
                    }
                },
                {
                    $sort: {
                        totalEnrolled: -1
                    }
                },
                {
                    $limit: 6
                }
            ];

            // Execute the aggregation pipeline on the classesCollection
            const result = await classesCollection.aggregate(pipeline).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error retrieving popular instructors:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Admin stats route
    app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
        try {
            const approvedClasses = await classesCollection.countDocuments({ status: 'approved' });
            const pendingClasses = await classesCollection.countDocuments({ status: 'pending' });
            const instructors = await userCollection.countDocuments({ role: 'instructor' });
            const totalClasses = await classesCollection.countDocuments();
            const totalEnrolled = await enrolledCollection.countDocuments();
            const result = {
                approvedClasses,
                pendingClasses,
                instructors,
                totalClasses,
                totalEnrolled
            };

            // Send the result as response
            res.send(result);
        } catch (error) {
            console.error("Error fetching admin stats:", error);
            res.status(500).send("Internal Server Error");
        }
    });
    // Get all instructors
    app.get('/instructors', async (req, res) => {
        try {
            const query = { role: 'instructor' };
            const result = await userCollection.find({ role: 'instructor' }).toArray();
            // Send the result as response
            res.send(result);
        } catch (error) {
            console.error("Error fetching instructors:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Get enrolled classes for a user
 
app.get('/enrolled-classes/:email', verifyJWT, async (req, res) => {
  try {
    const email = req.params.email;
    const query = { userEmail: email };

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "classes",
          localField: "classesId",
          foreignField: "_id",
          as: "classes"
        }
      },
      {
        $unwind: "$classes"
      },
      {
        $lookup: {
          from: "users",
          localField: "classes.instructorEmail",
          foreignField: "email",
          as: "instructor"
        }
      },
      {
        $project: {
          _id: 0,
          classes: 1,
          instructor: { $arrayElemAt: ["$instructor", 0] }
        }
      }
    ];

    const result = await enrolledCollection.aggregate(pipeline).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching enrolled classes:", error);
    res.status(500).send("Internal Server Error");
  }
});

    // Submit application to become an instructor
    app.post('/as-instructor', async (req, res) => {
        try {
            const data = req.body;
            const result = await appliedCollection.insertOne(data);
            res.send(result);
        } catch (error) {
            console.error("Error submitting instructor application:", error);
            res.status(500).send("Internal Server Error");
        }
    });
// Endpoint to get all applied instructors

    app.get('/applied-instructors', async (req, res) => {
    try {
        const result = await appliedCollection.find({}).toArray();
        res.send(result);
    } catch (error) {
        console.error("Error fetching applied instructors:", error);
        res.status(500).send("Internal Server Error");
    }
});


    // Get applied instructor information by email
    app.get('/applied-instructors/:email', async (req, res) => {
        try {
            // Extract email from request parameters
            const email = req.params.email;
            
            // Find the applied instructor data for the provided email
            const result = await appliedCollection.findOne({ email });
            
            // Send the result as response
            res.send(result);
        } catch (error) {
            console.error("Error fetching applied instructor information:", error);
            res.status(500).send("Internal Server Error");
        }
    });
    app.patch('/change-instructor-status/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { status, reason } = req.body;
        
        const result = await appliedCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, reason } }
        );
        
        res.send(result);
    } catch (error) {
        console.error("Error changing instructor status:", error);
        res.status(500).send("Internal Server Error");
    }
});
    app.listen(port, () => {
                console.log(`Example app listening on port ${port}`);
            });
        } catch (error) {
            console.error("Error connecting to MongoDB:", error);
        }
    }

    // Start the server and perform MongoDB operations
    startServer();


    app.get('/', (req, res) => {
        res.send('Yoga Master Server is running!');
    });
