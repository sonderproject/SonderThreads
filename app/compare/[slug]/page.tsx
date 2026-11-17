import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoPage, seoMetadata } from "@/components/marketing/SeoPage";
import { COMPARE_PAGES } from "@/lib/seo-pages";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = COMPARE_PAGES.find((p) => p.slug === slug);
  return page ? seoMetadata(page, `/compare/${slug}`) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = COMPARE_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();
  return <SeoPage page={page} path={`/compare/${slug}`} />;
}
