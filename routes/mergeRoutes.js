import express from "express";
import multer from "multer";
import { mergePDFs } from "../controllers/mergeController.js";

const router = express.Router();
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB total limit
});

// Accept array of files with field name 'files', max 10 files
router.post("/", upload.array("files", 10), mergePDFs);

export default router;
