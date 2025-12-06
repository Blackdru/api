import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ocrRoutes from "./routes/ocrRoutes.js";
import splitRoutes from "./routes/splitRoutes.js";
import mergeRoutes from "./routes/mergeRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use("/api/ocr", ocrRoutes);
app.use("/api/split", splitRoutes);
app.use("/api/merge", mergeRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
