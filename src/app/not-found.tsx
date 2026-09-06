import { getLocale } from "next-intl/server";
import { DocumentLocale } from "@/components/layout/document-locale";
import { NotFoundContent } from "@/components/layout/not-found-content";

export default async function NotFound() {
  const locale = await getLocale();
  const ko = locale !== "en";
  return (
    <main id="main-content" className="flex min-h-dvh items-center bg-cream px-4 py-12">
      <DocumentLocale locale={ko ? "ko" : "en"} />
      <NotFoundContent locale={locale} />
    </main>
  );
}
