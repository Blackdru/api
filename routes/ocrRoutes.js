import express from "express";
import multer from "multer";
import { runOCR } from "../controllers/ocrController.js";

const router = express.Router();
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post("/", upload.single("file"), runOCR);

export default router;
