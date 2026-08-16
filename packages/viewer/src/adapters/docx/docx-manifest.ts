import { type AdapterManifest, PROTOCOL_VERSION } from "../../core/types";

/**
 * Word documents. `.doc` (the pre-2007 binary format) is deliberately absent:
 * mammoth reads OOXML only, and claiming an extension we cannot open would trade
 * an honest "can't preview this file type" panel for a parse error.
 */
export const docxManifest: AdapterManifest = {
  id: "docx",
  protocol: PROTOCOL_VERSION,
  extensions: ["docx"],
  mediaTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  // No `rect`: a Word document has no page geometry here at all — mammoth
  // discards Word's layout, and the renderer reflows the blocks into this
  // system's prose, so a box on "page 3" would point at nothing.
  capabilities: { text: true, highlight: ["quote", "range"] },
  requires: ["mammoth"],
};
