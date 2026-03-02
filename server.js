const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");
const connectDB = require("./config/db");

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

connectDB();

const app = express();

// Swagger Configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Pran API",
      version: "1.0.0",
      description: "API documentation for the Pran Alumni project",
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? process.env.PROD_URL 
          : `http://localhost:${process.env.PORT || 5000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server'
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Use a single slash for the path to avoid potential routing issues
app.use("/api-docs", swaggerUi.serve);
app.get("/api-docs", swaggerUi.setup(swaggerDocs));

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to Pran API");
});

const peopleRoutes = require("./routes/peopleRoutes");
app.use("/api/people", peopleRoutes);

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const blogRoutes = require("./routes/blogRoutes");
app.use("/api/blogs", blogRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
