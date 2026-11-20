import Link from "next/link";
import { jsonLdScriptProps, siteUrl } from "@/lib/seo";
import { breadcrumbJsonLd, type Crumb } from "@/lib/notes-public/seo";

/** Visible breadcrumb trail plus its BreadcrumbList JSON-LD (same items). */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <script {...jsonLdScriptProps(breadcrumbJsonLd(siteUrl, crumbs))} />
      <nav aria-label="Breadcrumb" className="text-[13px] font-semibold text-faint">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {crumbs.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">›</span>}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="text-muted-foreground">
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
