/**
 * A real, minimal PDF — two pages of live text, ~1 KB, generated once and frozen
 * here so stories and tests need no network and no binary asset in the repo.
 *
 * It is a genuine file (catalog, page tree, content streams, xref), not a stub:
 * the point is that pdf.js actually opens it, rasterizes a page and exposes
 * selectable text — which a hand-waved fixture could not prove.
 */
export const SAMPLE_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwg" +
  "L1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA1IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUg" +
  "L1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9G" +
  "MSA3IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxMzcgPj4Kc3Ry" +
  "ZWFtCkJUIC9GMSAyNCBUZiA3MiA3MDAgVGQgKFF1YXJ0ZXJseSByZXBvcnQgLSBwYWdlIG9uZSkgVGogRVQKQlQgL0Yx" +
  "IDEyIFRmIDcyIDY2MCBUZCAoR2VuZXJhdGVkIGZpeHR1cmUgZm9yIHRoZSBicmFuZC11aSBmaWxlIHZpZXdlci4pIFRq" +
  "IEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBb" +
  "MCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDcgMCBSID4+ID4+IC9Db250ZW50cyA2IDAgUiA+" +
  "PgplbmRvYmoKNiAwIG9iago8PCAvTGVuZ3RoIDEyOSA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDcwMCBUZCAoQXBw" +
  "ZW5kaXggLSBwYWdlIHR3bykgVGogRVQKQlQgL0YxIDEyIFRmIDcyIDY2MCBUZCAoR2VuZXJhdGVkIGZpeHR1cmUgZm9y" +
  "IHRoZSBicmFuZC11aSBmaWxlIHZpZXdlci4pIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNyAwIG9iago8PCAvVHlwZSAv" +
  "Rm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAw" +
  "MDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAg" +
  "biAKMDAwMDAwMDI0NyAwMDAwMCBuIAowMDAwMDAwNDM1IDAwMDAwIG4gCjAwMDAwMDA1NjEgMDAwMDAgbiAKMDAwMDAw" +
  "MDc0MSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDggL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjgxMQolJUVPRgo=";

/** The same file as a data URI, ready to hand to `FileViewer` as a `url` source. */
export const SAMPLE_PDF_DATA_URI = `data:application/pdf;base64,${SAMPLE_PDF_BASE64}`;
