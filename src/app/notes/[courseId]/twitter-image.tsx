export { default, alt, size, contentType, generateStaticParams } from "./opengraph-image";

// Route segment config is read statically, so it is declared here, not re-exported (see opengraph-image.tsx).
export const dynamicParams = false;
export const revalidate = false;
