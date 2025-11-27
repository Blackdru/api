import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ocrRoutes from "./routes/ocrRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/ocr", ocrRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
