import { Suspense } from "react";

import { PDFChatPage } from "@/components/pdf/PDFChatPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default function PdfChatRoute() {
  return (
    <Suspense fallback={<PageLoader label="Loading PDF chat…" />}>
      <PDFChatPage />
    </Suspense>
  );
}
