/**
 * File types the analysis pipeline can read. Images are OCR'd natively by the
 * inference backend, so photos of handwritten notes are first-class material.
 */
export const UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.key,.txt,.md,image/*,audio/*";
