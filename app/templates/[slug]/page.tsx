import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoPage, seoMetadata } from "@/components/marketing/SeoPage";
import { TEMPLATE_PAGES } from "@/lib/seo-pages";

export const dynamicParams = false;

export function generateStaticParams() {
  return TEMPLATE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = TEMPLATE_PAGES.find((p) => p.slug === slug);
  return page ? seoMetadata(page, `/templates/${slug}`) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = TEMPLATE_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();
  return <SeoPage page={page} path={`/templates/${slug}`} />;
}
