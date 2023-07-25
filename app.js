// Import required modules and libraries
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const express = require("express");
const multer = require("multer");
const redis = require("redis");

// Create Express app and set the port number
const app = express();
const appPort = 3000;

// Set up Multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Redis configuration
const redisPort = 6379;
const host = "localhost"; // localhost or 127.0.0.1
 const redisClient = redis.createClient({
  host: host,
  port: redisPort,
});

// AWS S3 configuration
const region = "region";  // like ===> us-west-2
const endpoint = "your end point "; // arvan Storage endpoint Simin or Shahryar like ===> simmin  == > https://s3.ir-thr-at1.arvanstorage.ir
const accessKeyId = "accessKetyI"; // accessKey ID from Storage
const secretAccessKey = "secretAccessKey"; // secretAccessKey from Storage
const s3Client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
  endpoint: endpoint,
});

// Middleware to parse JSON in request body
app.use(express.json());

// Route for uploading images
app.post("/api/images", upload.single("image"), async (request, response) => {
  // Check if a file was received in the request
  const imageFile = request.file;
  if (!imageFile) {
    return response.status(400).json({ error: "===> No image file received." });
  }

  // Extract date and generate a unique identifier for the image
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const uniqueIdentifier = Math.random().toString(36).substring(7);
  const imageName = `${year}-${month}-${day}-${uniqueIdentifier}.jpg`;

  // Prepare S3 upload parameters
  const params = {
    Bucket: "Your_Bucket_Name", // Replace this with the appropriate S3 bucket name
    Key: imageName,
    Body: imageFile.buffer,
    ACL: "public-read", // Set appropriate S3 ACL permissions as required
  };

  try {
    // Upload the image to S3
    const data = await s3Client.send(new PutObjectCommand(params));

    // Prepare image metadata to store in Redis
    const imageMetadata = {
      name: imageFile.originalname,
      date: `${year}-${month}-${day}`,
    };

    console.log("===>", imageMetadata);

    // Store image metadata in Redis with a hashset
    redisClient.hset(
      `${year}:${month}:${day}`,
      uniqueIdentifier,
      JSON.stringify(imageMetadata),
      (err, reply) => {
        if (err) {
          console.error("===> Error storing image metadata in Redis:", err);
          return response
            .status(500)
            .json({ error: "===> Failed to store image metadata <===" });
        }

        console.log("===> Image metadata stored in Redis:", reply);

        // Respond with success message and S3 image URL
        return response
          .status(200)
          .json({ success: "===> Image Upload Successful <===" });
      }
    );
  } catch (err) {
    console.error("===> Error uploading image to S3:", err);
    return response
      .status(500)
      .json({ error: "===> Failed to upload the image." });
  }
});

// Route for retrieving images based on date from Redis
app.get("/api/images/:year/:month/:day", (request, response) => {
  const { year, month, day } = request.params;

  // Retrieve image metadata from Redis using the hashset
  redisClient.hgetall(`${year}:${month}:${day}`, (err, images) => {
    if (err) {
      console.error("===> Error retrieving image metadata from Redis:", err);
      return response
        .status(500)
        .json({ error: "===> Failed to retrieve image metadata." });
    }

    // If no images are found for the specified date, respond with a 404 status
    if (!images) {
      return response
        .status(404)
        .json({ error: "===> No images found for the specified date." });
    }

    // Parse the retrieved JSON image metadata and respond with the list of images
    const imageList = Object.values(images).map((image) => JSON.parse(image));
    return response.status(200).json({ images: imageList });
  });
});

// Start the server and listen on the specified port
app.listen(appPort, () => {
  console.log(`
    **** Server is Running on port ${appPort} ****
    for GET Method, Use The Browser, Curl Or POSTMAN ===> localhost:${appPort}/api/images/YYYY/MM/DD <===
    Replace Date You Want to YYYY/MM/DD Like ===> localhost:${appPort}/api/images/2023/07/24 <===
    for POST Method, Use Curl Or POSTMAN ===> localhost:${appPort}/api/images <===
    If using POSTMAN select POST Method & fill Input Field Like localhost:3000/api/images
    & in Tabs Select Body ==> form-data ==> key must be image ==> for value select image file ==> send.
  
  `);
});
