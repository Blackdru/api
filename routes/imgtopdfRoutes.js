import express from "express";
import multer from "multer";
import { convertImagesToPDF } from "../controllers/imgtopdfController.js";

const router = express.Router();
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB total limit
});

// Accept array of image files with field name 'files', max 10 files
router.post("/", upload.array("files", 10), convertImagesToPDF);

export default router;
