import Link from "next/link";
import { jsonLdScriptProps, siteUrl } from "@/lib/seo";
import { breadcrumbJsonLd, type Crumb } from "@/lib/notes-public/seo";

/** Visible breadcrumb trail plus its BreadcrumbList JSON-LD (same items). */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <script {...jsonLdScriptProps(breadcrumbJsonLd(siteUrl, crumbs))} />
      <nav aria-label="Breadcrumb" className="-mx-4 overflow-x-auto px-4 text-[13.5px] font-bold text-muted-foreground [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ol className="flex w-max items-center gap-x-1.5 whitespace-nowrap">
          {crumbs.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="text-faint">
                  ›
                </span>
              )}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="text-foreground">
                  {c.name}
                </span>
              ) : (
                <Link href={c.path} className="hover:text-accent">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
