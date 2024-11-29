const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ddnvttm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)

        const database = client.db("Selim");
        const studentCollection = database.collection("StudentCollection");
        const mealCollection = database.collection("MealCollection");
        const NoticeCollection = database.collection("NoticeCollection");

        app.get('/students', async (req, res) => {
            const data = await studentCollection.find().toArray(); // Fetch all documents
            res.send(data);
        })

        app.get('/students/:id', async (req, res) => {
            const studentId = req.params.id;

            const student = await studentCollection.findOne({ _id: new ObjectId(studentId) });
            console.log(studentId);
            res.send(student);


        });

        // API to publish a notice
    app.post('/api/notices', async (req, res) => {
      const { title, content, createdBy } = req.body;

      // Validate required fields
      if (!title || !content || !createdBy) {
        return res.status(400).json({ error: "All fields (title, content, createdBy) are required" });
      }

      try {
        const newNotice = {
          title,
          content,
          createdBy,
          createdAt: new Date(), // Add a timestamp for when the notice was created
        };

        // Insert the notice into the NoticeCollection
        const result = await NoticeCollection.insertOne(newNotice);

        if (result.insertedId) {
          res.status(201).json({ message: "Notice published successfully", noticeId: result.insertedId });
        } else {
          res.status(500).json({ error: "Failed to publish the notice" });
        }
      } catch (error) {
        console.error("Error publishing notice:", error);
        res.status(500).json({ error: "An error occurred while publishing the notice" });
      }
    });

    // API to fetch all notices
    app.get('/api/notices', async (req, res) => {
      try {
        const notices = await NoticeCollection.find().sort({ createdAt: -1 }).toArray(); // Sort by createdAt descending
        res.status(200).json(notices);
      } catch (error) {
        console.error("Error fetching notices:", error);
        res.status(500).json({ error: "Failed to fetch notices" });
      }
    });

    
    app.get('/notices/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await NoticeCollection.findOne(query)
      res.send(result)
    })

       

        const updateMealCount = async (date, increment) => {
            const operation = increment ? { $inc: { count: 1 } } : { $inc: { count: -1 } };
            
            await mealCollection.updateOne(
              { date: new Date(date).toISOString().split('T')[0] }, // Ensure date format is YYYY-MM-DD
              operation,
              { upsert: true } // Create the document if it doesn’t exist
            );
          };

          
          
        app.patch('/students/:studentId/meals',  async (req, res) => {
            const { studentId } = req.params;
            const { date, action } = req.body;
            console.log(date);
          
            if (!date || !action) {
              return res.status(400).json({ error: 'Invalid request. Expected "date" and "action" in request body.' });
            }
          
            try {
              let studentObjectId;
              try {
                studentObjectId = new ObjectId(studentId);
              } catch (error) {
                console.error('Invalid ObjectId format:', studentId);
                return res.status(400).json({ error: 'Invalid student ID format' });
              }
          
              // Fetch student data
              const student = await studentCollection.findOne({ _id: studentObjectId });
              if (!student) {
                return res.status(404).json({ error: 'Student not found' });
              }
          
              const dateFormatted = new Date(date).toISOString().split('T')[0];
              const dateExists = student.mealDates.some(d => new Date(d).toISOString().split('T')[0] === dateFormatted);
          
              if (action === 'add' && !dateExists) {
                // Add date to student’s mealDates and update MealCollection
                await studentCollection.updateOne(
                  { _id: studentObjectId },
                  { $push: { mealDates: new Date(date) } }
                );
                await updateMealCount(dateFormatted, true); // Increment meal count
              } else if (action === 'remove' && dateExists) {
                // Remove date from student’s mealDates and update MealCollection
                await studentCollection.updateOne(
                  { _id: studentObjectId },
                  { $pull: { mealDates: new Date(date) } }
                );
                await updateMealCount(dateFormatted, false); // Decrement meal count
              } else {
                return res.status(400).json({ error: 'Action or date is invalid' });
              }
          
              res.status(200).json({ message: 'Meal date updated successfully' });
            } catch (error) {
              console.error('Error updating meal dates:', error);
              res.status(500).json({ error: 'Failed to update meal dates' });
            }
          });
       

          app.get('/meals/today', async (req, res) => {
            try {
                // Get today's date in YYYY-MM-DD format
                const today = new Date().toISOString().split('T')[0];
        
                // Query the MealCollection for today's meal count
                const mealData = await mealCollection.findOne({ date: today });
        
                // If no entry exists, return count as 0
                const totalMeals = mealData ? mealData.count : 0;
        
                res.status(200).json({ date: today, totalMeals });
            } catch (error) {
                console.error("Error fetching today's meal count:", error);
                res.status(500).json({ error: 'Failed to fetch meal count' });
            }
        });

        app.get('/meals/count', async (req, res) => {
          const { date } = req.query; // Expecting the date in the query params
      
          try {
              if (!date) {
                  return res.status(400).json({ error: 'Date is required in the query parameter' });
              }
      
              // Ensure the date format is consistent (YYYY-MM-DD)
              const formattedDate = new Date(date).toISOString().split('T')[0];
      
              // Query the MealCollection for the specified date
              const mealData = await mealCollection.findOne({ date: formattedDate });
      
              // If no entry exists for the date, return count as 0
              const mealCount = mealData ? mealData.count : 0;
      
              res.status(200).json({ date: formattedDate, mealCount });
          } catch (error) {
              console.error("Error fetching meal count:", error);
              res.status(500).json({ error: 'Failed to fetch meal count' });
          }
      });
      
        
        

          app.get('/students/email/:email', async (req, res) => {
            const { email } = req.params;
          
            try {
              // Find student by email in MongoDB
              const student = await studentCollection.findOne({ email });
          
              if (!student) {
                return res.status(404).json({ error: 'Student not found' });
              }
          
              // Return student data if found
              res.status(200).json(student);
            } catch (error) {
              console.error("Error fetching student:", error);
              res.status(500).json({ error: 'Failed to fetch student' });
            }
          });

          app.post('/signup', async (req, res) => {
            const { name, email, image_url, contact_no,roll } = req.body;
        
            // Validate the basic required fields
            if (!name || !email || !roll || !contact_no) {
                return res.status(400).json({ error: 'Please fill in all required fields (name, email, password, contact number).' });
            }
        
            try {
                // Check if a student with the same email already exists
                const existingStudent = await studentCollection.findOne({ email });
                if (existingStudent) {
                    return res.status(400).json({ error: 'Student already exists with this email.' });
                }
                console.log('yes coming');
        
                // Hash the password using bcrypt
                //const hashedPassword = await bcrypt.hash(password, 10);
        
                // Create a new student object
                const newStudent = {
                    name,
                    email,
                    roll,
                   // password: hashedPassword,
                   room_no : '0',
                    contact_no,
                    image_url: image_url || "", // Optional image URL
                    mealDates: [] // Initialize with an empty mealDates array
                };
        
                // Insert the student into the collection
                const result = await studentCollection.insertOne(newStudent);
        
                return res.status(201).json({ message: 'Student signed up successfully!', studentId: result.insertedId });
            } catch (error) {
                console.error('Error signing up student:', error);
                return res.status(500).json({ error: 'Failed to sign up student.' });
            }
        });
          
          
          

      //  await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('boss is sitting');
})

app.listen(port, () => {
    console.log(`Bistro boss is here in port ${port}`);
})